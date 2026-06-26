import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminDisputeRow } from "@/lib/admin/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/disputes — authority disputes feeding leaderboard fairness. */
export async function GET(): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_disputes");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disputes: (data ?? []) as AdminDisputeRow[] });
}

/** POST /api/admin/disputes { reportId, excluded } — toggle excluded_from_ranking. */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { reportId?: string; excluded?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.reportId ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid reportId." }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("reports")
    .update({ excluded_from_ranking: body.excluded !== false } as never)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
