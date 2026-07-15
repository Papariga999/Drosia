import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";
import { readJsonBody, RequestBodyError } from "@/lib/http-body";

export const runtime = "nodejs";

/**
 * POST /api/flag — DSA notice-and-takedown. Public, login-free: anyone can flag
 * a published report. Writes content_flags(status='open') for the admin queue.
 * Rate-limited + honeypot. Never reveals whether a token exists beyond a generic
 * response.
 */
function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const bodySchema = z
  .object({
    token: z.string().trim().regex(/^[0-9a-f]{8,64}$/i),
    reason: z.string().trim().min(1).max(300),
    contact: z.string().trim().max(200).optional().default(""),
    website: z.string().max(0).optional().default(""),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  if (!configured()) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 503 });
  }

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`flag:${ip}`, 8, 10 * 60 * 1000, {
    failClosedInProduction: true,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many reports." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const { token, reason } = parsed.data;
  const contact = parsed.data.contact || null;

  const admin = getSupabaseAdmin();
  const { data: report, error: lookupError } = await admin
    .from("v_public_reports")
    .select("id")
    .eq("public_token", token)
    .maybeSingle<{ id: string }>();
  if (lookupError) {
    console.error("[/api/flag] report lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not submit notice." }, { status: 503 });
  }

  // Generic response either way (don't reveal token existence).
  if (report?.id) {
    const { error } = await admin.from("content_flags").insert({
      report_id: report.id,
      reason,
      reporter_contact: contact,
      status: "open",
    } as never);
    if (error) {
      console.error("[/api/flag] notice insert failed:", error.message);
      return NextResponse.json({ error: "Could not submit notice." }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}
