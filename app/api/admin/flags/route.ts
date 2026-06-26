import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminFlagRow } from "@/lib/admin/types";

export const runtime = "nodejs";

/** GET /api/admin/flags?status=open — DSA takedown queue. */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status");
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_flags", { p_status: status } as never);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flags: (data ?? []) as AdminFlagRow[] });
}
