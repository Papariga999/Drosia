import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anonymizeReportPhotos } from "@/lib/anonymize-runner";
import { deliverAndLog } from "@/lib/admin/deliver-report";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/approve  { id, notify? }
 *
 * Gate: every photo must be blur_status='done' (anonymized) before publishing —
 * we try to (re)run anonymization first, then verify. On approve:
 *   submitted → in_review (public, anonymized only)
 *   then (when notify !== false) deliverReport() → on success → notified
 *   (+ notified_at), logged. No authority email/channel → HOLD at in_review
 *   ("awaiting authority channel").
 * notify=false publishes WITHOUT emailing the authority — the report stays
 * in_review and no delivery is attempted/logged (operator can notify later).
 * Every delivery attempt is written to delivery_logs — never a silent failure.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; notify?: boolean };
  try {
    body = await readJsonBody<typeof body>(req);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (body.notify !== undefined && typeof body.notify !== "boolean") {
    return NextResponse.json({ error: "Invalid notify value." }, { status: 400 });
  }
  const notifyRequested = body.notify !== false;

  const admin = getSupabaseAdmin();

  const { data: report, error: loadError } = await admin
    .from("reports")
    .select("id, status, authority_id")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string; authority_id: string | null }>();

  if (loadError || !report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status !== "submitted" && report.status !== "in_review") {
    return NextResponse.json(
      { error: `Cannot approve a report in status '${report.status}'.` },
      { status: 409 },
    );
  }
  // Worldwide reports without a routed authority publish normally, but must not
  // attempt or log an authority delivery. Delivery can happen later after routing.
  const notify = notifyRequested && report.authority_id !== null;

  // Ensure anonymization is done before anything becomes public.
  try {
    await anonymizeReportPhotos(report.id);
  } catch (error) {
    console.error("[/api/admin/reports/approve] anonymization failed:", error);
    return NextResponse.json({ error: "Anonymization failed; report remains private." }, { status: 502 });
  }
  const { data: photos, error: photoError } = await admin
    .from("report_photos")
    .select("blur_status, public_path")
    .eq("report_id", report.id)
    .returns<{ blur_status: string; public_path: string | null }[]>();
  if (photoError || !photos?.length) {
    return NextResponse.json({ error: "At least one report photo is required." }, { status: 409 });
  }
  if (photos.some((photo) => photo.blur_status !== "done" || !photo.public_path)) {
    return NextResponse.json({ error: "Awaiting anonymization (blur not done)." }, { status: 409 });
  }

  // Publish first (anonymized + approved → public). If this fails, stop — we must
  // not email an authority a link to a report that never became public.
  const { error: publishError } = await admin
    .from("reports")
    .update({ status: "in_review" } as never)
    .eq("id", report.id);
  if (publishError) {
    return NextResponse.json({ error: publishError.message }, { status: 500 });
  }

  // Publish without notifying: no email, no delivery_logs row, hold at in_review.
  if (!notify) {
    return NextResponse.json({ status: "in_review", delivery: "skipped" });
  }

  // Deliver + log (shared with resend).
  const result = await deliverAndLog(report.id);

  if (result.delivery === "awaiting_channel") {
    return NextResponse.json({ status: "in_review", delivery: "awaiting_channel" });
  }
  if (result.delivery === "sent") {
    return NextResponse.json({ status: result.status, delivery: "sent" });
  }
  if (result.delivery === "invalid_state") {
    return NextResponse.json({ status: result.status, delivery: result.delivery, error: result.error }, { status: 409 });
  }
  if (result.delivery === "log_failed" || result.delivery === "sent_status_failed") {
    return NextResponse.json({ status: result.status, delivery: result.delivery, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ status: "in_review", delivery: "failed", error: result.error });
}
