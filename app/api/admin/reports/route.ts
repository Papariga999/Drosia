import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anonymizedPhotoUrl } from "@/lib/storage";
import type { AdminReportRow } from "@/lib/admin/types";

export const runtime = "nodejs";

/** GET /api/admin/reports?status=submitted — moderation queue (service role). */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const { data, error } = await admin.rpc("admin_list_reports", {
    p_status: status,
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const reports = (data ?? []) as AdminReportRow[];

  // Attach each report's ANONYMIZED preview. Admin previews use the same public
  // variant as shared surfaces — originals stay service-role only. Reports still
  // awaiting blur (no public_path) get null and fall back to a placeholder.
  const ids = reports.map((r) => r.id);
  const byReport = new Map<string, string>();
  if (ids.length) {
    const { data: photos } = await admin
      .from("report_photos")
      .select("report_id, public_path, created_at")
      .in("report_id", ids)
      .eq("blur_status", "done")
      .not("public_path", "is", null)
      .order("created_at", { ascending: true });
    for (const p of (photos ?? []) as { report_id: string; public_path: string | null }[]) {
      if (p.public_path && !byReport.has(p.report_id)) byReport.set(p.report_id, p.public_path);
    }
  }

  const withPhotos = reports.map((r) => {
    const path = byReport.get(r.id);
    return { ...r, photo_url: path ? anonymizedPhotoUrl(path) : null };
  });
  return NextResponse.json({ reports: withPhotos });
}
