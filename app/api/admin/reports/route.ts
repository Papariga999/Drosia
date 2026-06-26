import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminReportRow } from "@/lib/admin/types";

export const runtime = "nodejs";

/** GET /api/admin/reports?status=submitted — moderation queue (service role). */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = new URL(req.url).searchParams.get("status");
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_reports", {
    p_status: status,
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reports: (data ?? []) as AdminReportRow[] });
}
