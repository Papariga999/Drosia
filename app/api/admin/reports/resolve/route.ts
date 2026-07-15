import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDict, isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site-url";
import { notifyReportFollowers } from "@/lib/push/send";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/resolve  { id }
 *
 * Operator marks a delivered report as fixed: notified → resolved
 * (terminal) + resolved_at, then pushes the "resolved" notification to followers
 * (fire-and-forget; no-op until VAPID keys are set). Not allowed from submitted
 * (approve first) or terminal states — the resolved/notified ranking quote stays
 * honest because the denominator only ever counts notified reports.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await readJsonBody<typeof body>(req);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const admin = getSupabaseAdmin();

  const { data: report } = await admin
    .from("reports")
    .select("id, public_token, locale, status")
    .eq("id", id)
    .maybeSingle<{ id: string; public_token: string; locale: string; status: string }>();

  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status !== "notified") {
    return NextResponse.json(
      { error: `Cannot resolve a report in status '${report.status}'.` },
      { status: 409 },
    );
  }

  const { error } = await admin
    .from("reports")
    .update({ status: "resolved", resolved_at: new Date().toISOString() } as never)
    .eq("id", report.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tell followers their report was fixed — the most satisfying update in the
  // loop. Fire-and-forget: a push failure never rolls back the transition.
  const dict = getDict(isLocale(report.locale) ? report.locale : DEFAULT_LOCALE);
  await notifyReportFollowers(report.id, {
    title: dict.push.resolvedTitle,
    body: dict.push.resolvedBody,
    url: `${SITE_URL}/r/${report.public_token}`,
  });

  return NextResponse.json({ status: "resolved" });
}
