import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** True when web_events / the RPC aren't created yet (migration pending). */
function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const blob = `${e?.code ?? ""} ${e?.message ?? ""}`;
  return /web_events|admin_web_analytics/.test(blob) && /(does not exist|schema cache|42P01|PGRST202|PGRST205)/i.test(blob);
}

/** GET /api/admin/analytics?days=30 — cookieless traffic + reports funnel aggregate. */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

  const { data, error } = await getSupabaseAdmin().rpc("admin_web_analytics", { p_days: days } as never);
  if (error) {
    if (isMissing(error)) return NextResponse.json({ needsMigration: true, days });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ analytics: data, days });
}
