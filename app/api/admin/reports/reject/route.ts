import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { purgePublicPhotos } from "@/lib/admin/takedown";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = ["private_person", "spam_invalid", "out_of_scope"];

/** POST /api/admin/reports/reject  { id, reason } → status rejected (terminal). */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; reason?: string };
  try {
    body = await readJsonBody<typeof body>(req);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (!body.reason || !REASONS.includes(body.reason)) {
    return NextResponse.json({ error: "Invalid reason." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: report } = await admin
    .from("reports")
    .select("status")
    .eq("id", id)
    .maybeSingle<{ status: string }>();
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status === "resolved") {
    return NextResponse.json(
      { error: `Reports in status '${report.status}' are terminal.` },
      { status: 409 },
    );
  }

  if (report.status !== "rejected") {
    const { error } = await admin
      .from("reports")
      .update({ status: "rejected", reject_reason: body.reason } as never)
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Remove any already-published anonymized photo from the public bucket.
  try {
    await purgePublicPhotos(id);
  } catch (purgeError) {
    console.error("[/api/admin/reports/reject] public photo purge failed:", purgeError);
    return NextResponse.json(
      { error: "Report is hidden, but public photo purge failed. Retry the takedown." },
      { status: 502 },
    );
  }
  return NextResponse.json({ status: "rejected" });
}
