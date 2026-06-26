import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminDeliveryRow, DeliveryHealth } from "@/lib/admin/types";

export const runtime = "nodejs";

/** GET /api/admin/deliveries?status= — delivery & bounce monitor (recent 200). */
export async function GET(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status");
  const { data, error } = await getSupabaseAdmin().rpc("admin_list_deliveries", { p_status: status } as never);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as AdminDeliveryRow[];
  const total = rows.length;
  const good = rows.filter((r) => r.status === "sent" || r.status === "delivered").length;
  const bad = rows.filter((r) => ["bounced", "complained", "failed"].includes(r.status)).length;

  const from = process.env.EMAIL_FROM ?? null;
  const fromDomain = from?.split("@").pop()?.replace(/>$/, "").trim().toLowerCase() ?? null;
  const verifiedDomain = process.env.EMAIL_VERIFIED_DOMAIN?.toLowerCase() ?? null;

  const health: DeliveryHealth = {
    total,
    deliveredPct: total ? Math.round((good / total) * 100) : 0,
    bouncePct: total ? Math.round((bad / total) * 100) : 0,
    fromDomain,
    verifiedDomain,
    domainVerified: !verifiedDomain || (!!fromDomain && fromDomain === verifiedDomain),
  };

  return NextResponse.json({ deliveries: rows, health });
}
