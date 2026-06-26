import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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

export async function POST(req: Request): Promise<Response> {
  if (!configured()) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 503 });
  }

  const ip = clientIp(req.headers);
  const limit = rateLimit(`flag:${ip}`, 8, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "Too many reports." }, { status: 429 });

  let body: { token?: string; reason?: string; contact?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (body.website?.length) return NextResponse.json({ error: "Invalid." }, { status: 400 }); // honeypot

  const token = (body.token ?? "").trim();
  const reason = (body.reason ?? "").trim();
  const contact = (body.contact ?? "").trim().slice(0, 200) || null;
  if (!token || !reason) return NextResponse.json({ error: "Reason is required." }, { status: 400 });
  if (reason.length > 300) return NextResponse.json({ error: "Reason too long." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: report } = await admin
    .from("reports")
    .select("id")
    .eq("public_token", token)
    .maybeSingle<{ id: string }>();

  // Generic response either way (don't reveal token existence).
  if (report?.id) {
    await admin.from("content_flags").insert({
      report_id: report.id,
      reason,
      reporter_contact: contact,
      status: "open",
    } as never);
  }

  return NextResponse.json({ ok: true });
}
