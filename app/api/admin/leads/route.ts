import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminLeadRow } from "@/lib/admin/types";

export const runtime = "nodejs";

/** True when support_leads isn't created yet (migration pending on this env). */
function isMissing(error: { code?: string; message?: string } | null): boolean {
  const blob = `${error?.code ?? ""} ${error?.message ?? ""}`;
  return /support_leads/.test(blob) && /(does not exist|schema cache|42P01|PGRST205)/i.test(blob);
}

/** GET /api/admin/leads — supporter/partner first-contact leads, newest first. */
export async function GET(): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from("support_leads")
    .select("id, name, organisation, email, role, place, message, locale, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    if (isMissing(error)) return NextResponse.json({ leads: [], needsMigration: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ leads: (data ?? []) as AdminLeadRow[] });
}
