import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anonymizeReportPhotos } from "@/lib/anonymize-runner";
import { deliverAndLog } from "@/lib/admin/deliver-report";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/approve  { id }
 *
 * Gate: every photo must be blur_status='done' (anonymized) before publishing —
 * we try to (re)run anonymization first, then verify. On approve:
 *   submitted → in_review (public, anonymized only)
 *   then deliverReport() → on success → notified (+ notified_at), logged.
 *   No authority email/channel → HOLD at in_review ("awaiting authority channel").
 * Every delivery attempt is written to delivery_logs — never a silent failure.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: report, error: loadError } = await admin
    .from("reports")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string }>();

  if (loadError || !report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status === "rejected") {
    return NextResponse.json({ error: "Report was rejected." }, { status: 409 });
  }

  // Ensure anonymization is done before anything becomes public.
  await anonymizeReportPhotos(report.id);
  const { count: pending } = await admin
    .from("report_photos")
    .select("id", { count: "exact", head: true })
    .eq("report_id", report.id)
    .neq("blur_status", "done");
  if ((pending ?? 0) > 0) {
    return NextResponse.json({ error: "Awaiting anonymization (blur not done)." }, { status: 409 });
  }

  // Publish, then deliver + log (shared with resend).
  await admin.from("reports").update({ status: "in_review" } as never).eq("id", report.id);
  const result = await deliverAndLog(report.id);

  if (result.delivery === "awaiting_channel") {
    return NextResponse.json({ status: "in_review", delivery: "awaiting_channel" });
  }
  if (result.delivery === "sent") {
    return NextResponse.json({ status: "notified", delivery: "sent" });
  }
  return NextResponse.json({ status: "in_review", delivery: "failed", error: result.error });
}
