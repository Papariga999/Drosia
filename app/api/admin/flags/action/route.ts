import { NextResponse } from "next/server";
import { verifyAdminMutation } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { purgePublicPhotos } from "@/lib/admin/takedown";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/flags/action { id, action }
 *   remove  → flag actioned + report unpublished (DSA takedown)
 *   dismiss → flag dismissed (content stays)
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; action?: string };
  try {
    body = await readJsonBody<typeof body>(req);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (body.action !== "remove" && body.action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: flag } = await admin
    .from("content_flags")
    .select("id, report_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; report_id: string; status: string }>();
  if (!flag) return NextResponse.json({ error: "Flag not found." }, { status: 404 });
  if (flag.status !== "open") {
    return NextResponse.json({ error: `Flag is already '${flag.status}'.` }, { status: 409 });
  }

  if (body.action === "remove") {
    // Order matters: the report must be taken off every public
    // surface) BEFORE the flag is marked actioned — otherwise a failed update
    // would record a takedown that never happened.
    const { data: report } = await admin
      .from("reports")
      .select("status")
      .eq("id", flag.report_id)
      .maybeSingle<{ status: string }>();
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const reportPatch =
      report.status === "resolved"
        ? { admin_hidden: true, reject_reason: "dsa_takedown" }
        : { status: "rejected", reject_reason: "dsa_takedown" };
    const { error: rejectError } = await admin
      .from("reports")
      .update(reportPatch as never)
      .eq("id", flag.report_id);
    if (rejectError) return NextResponse.json({ error: rejectError.message }, { status: 500 });

    try {
      await purgePublicPhotos(flag.report_id); // DSA takedown: drop the public photo object
    } catch (error) {
      console.error("[/api/admin/flags/action] public photo purge failed:", error);
      return NextResponse.json({ error: "Public photo purge failed; retry the open flag." }, { status: 502 });
    }

    const { error: flagError } = await admin
      .from("content_flags")
      .update({ status: "actioned" } as never)
      .eq("id", id);
    if (flagError) return NextResponse.json({ error: flagError.message }, { status: 500 });

    return NextResponse.json({ ok: true, action: "removed" });
  }

  const { error: dismissError } = await admin
    .from("content_flags")
    .update({ status: "dismissed" } as never)
    .eq("id", id);
  if (dismissError) return NextResponse.json({ error: dismissError.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: "dismissed" });
}
