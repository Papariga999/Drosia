import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const blob = `${e?.code ?? ""} ${e?.message ?? ""}`;
  return /admin_report_analytics|reject_reason/.test(blob) && /(does not exist|schema cache|42P01|42703|PGRST202|PGRST204)/i.test(blob);
}

/** GET /api/admin/report-analytics?days=90 — civic-outcome reporting from existing data. */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days = [30, 90, 365].includes(daysParam) ? daysParam : 90;

  const { data, error } = await getSupabaseAdmin().rpc("admin_report_analytics", { p_days: days } as never);
  if (error) {
    if (isMissing(error)) return NextResponse.json({ needsMigration: true, days });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ analytics: data, days });
}
