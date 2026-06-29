import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/vote — anonymous engagement (Phase 3). One 👍 'priority' or 🔴
 * 'still_here' per device per report, deduped by the (report_id, voter_token,
 * type) UNIQUE constraint. Login-free: voter_token is the client device token
 * (NOT PII). Rate-limited per IP; honeypot. Only published reports are votable.
 * Counts are denormalized by a DB trigger, so we read them back fresh.
 */
const bodySchema = z.object({
  token: z.string().trim().min(1).max(64), // report public_token
  type: z.enum(["priority", "still_here"]),
  voterToken: z.string().trim().min(8).max(128),
  website: z.string().max(0).optional().default(""), // honeypot
});

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const PUBLISHED = ["in_review", "notified", "resolved"];

export async function POST(req: Request): Promise<Response> {
  if (!configured()) return NextResponse.json({ error: "Backend not configured." }, { status: 503 });

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`vote:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many votes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const { token, type, voterToken, website } = parsed.data;
  if (website) return NextResponse.json({ error: "Invalid." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: report } = await admin
    .from("reports")
    .select("id, status, vote_count, confirm_count")
    .eq("public_token", token)
    .maybeSingle<{ id: string; status: string; vote_count: number; confirm_count: number }>();
  if (!report || !PUBLISHED.includes(report.status)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { error } = await admin
    .from("report_votes")
    .insert({ report_id: report.id, voter_token: voterToken, type } as never);
  // 23505 = unique violation → already voted; idempotent, not an error.
  const deduped = error?.code === "23505";
  if (error && !deduped) {
    return NextResponse.json({ error: "Vote failed." }, { status: 500 });
  }

  const { data: fresh } = await admin
    .from("reports")
    .select("vote_count, confirm_count")
    .eq("id", report.id)
    .maybeSingle<{ vote_count: number; confirm_count: number }>();

  return NextResponse.json({
    vote_count: fresh?.vote_count ?? report.vote_count,
    confirm_count: fresh?.confirm_count ?? report.confirm_count,
    deduped,
  });
}
