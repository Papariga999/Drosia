import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { deleteReportCompletely } from "@/lib/admin/delete-report";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/delete  { id }
 *
 * Hard-delete a report: removes its photos from both storage buckets and deletes
 * the row (child tables cascade). Irreversible — meant for test/junk reports.
 * For reversible takedown use reject (status) or visibility (admin_hidden).
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

  const result = await deleteReportCompletely(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 500 });
  }
  return NextResponse.json({ ok: true });
}
