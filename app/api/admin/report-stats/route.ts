import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN = /^[0-9a-f]{8,32}$/i;

/** GET /api/admin/report-stats?token=… — per-report views + vote breakdown. */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = (new URL(req.url).searchParams.get("token") ?? "").toLowerCase();
  if (!TOKEN.test(token)) return NextResponse.json({ error: "Invalid token." }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().rpc("admin_report_stats", { p_token: token } as never);
  if (error) {
    // Degrade silently if the stats RPC isn't migrated yet.
    return NextResponse.json({ stats: null });
  }
  return NextResponse.json({ stats: data });
}
