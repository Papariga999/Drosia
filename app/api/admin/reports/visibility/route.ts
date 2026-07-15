import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/visibility  { id, hidden: boolean }
 *
 * Reversibly pause/deactivate (hidden=true) or republish (hidden=false) a report.
 * Sets reports.admin_hidden, which the public views (v_public_reports,
 * v_public_report_photos) and the scorecard all filter on, so the report drops
 * off every public surface immediately while staying in the DB + admin board.
 * Anonymized photos are intentionally kept (already privacy-safe) so republish is
 * lossless; for permanent erasure use delete, for DSA takedown use reject.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; hidden?: boolean };
  try {
    body = await readJsonBody<typeof body>(req);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Missing 'hidden' boolean." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("reports")
    .update({ admin_hidden: body.hidden } as never)
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true, admin_hidden: body.hidden });
}
