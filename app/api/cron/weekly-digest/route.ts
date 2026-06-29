import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/cron/weekly-digest — weekly founder summary email (Vercel Cron).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET
 * is set; we also accept WEBHOOK_SECRET. Recipients come from FOUNDER_EMAILS
 * (comma-separated). Sends via Resend; falls back to dev-log when RESEND_API_KEY
 * is absent (so it never errors before email is configured).
 */
function n(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || process.env.WEBHOOK_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = (process.env.FOUNDER_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) return NextResponse.json({ skipped: "FOUNDER_EMAILS not set" });

  const admin = getSupabaseAdmin();
  const [{ data: web }, { data: rep }] = await Promise.all([
    admin.rpc("admin_web_analytics", { p_days: 7 } as never),
    admin.rpc("admin_report_analytics", { p_days: 7 } as never),
  ]);

  const w = (web ?? {}) as { web?: Record<string, unknown>; funnel?: Record<string, unknown> };
  const r = (rep ?? {}) as { totals?: { reports?: number }; resolution?: Record<string, unknown> };
  const wv = w.web ?? {};
  const fn = w.funnel ?? {};
  const sessions = n(wv.sessions);
  const submitted = n(fn.submit_success);
  const conv = sessions > 0 ? Math.round((submitted / sessions) * 1000) / 10 : 0;

  const subject = `Drosia weekly · ${n(wv.pageviews)} views · ${n(r.totals?.reports)} reports`;
  const text = [
    `Drosia — last 7 days`,
    ``,
    `Traffic`,
    `  Page views: ${n(wv.pageviews)}`,
    `  Sessions:   ${sessions}`,
    `  Report views: ${n(wv.report_views)}`,
    ``,
    `Report funnel (sessions)`,
    `  Started:   ${n(fn.report_start)}`,
    `  Submitted: ${submitted}  (session→report ${conv}%)`,
    `  Failed:    ${n(fn.submit_fail)}`,
    ``,
    `Civic outcomes`,
    `  Reports submitted: ${n(r.totals?.reports)}`,
    `  Notified: ${n(r.resolution?.notified)}   Resolved: ${n(r.resolution?.resolved)}`,
    ``,
    `Full dashboard: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin`,
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY?.startsWith("re_") ? process.env.RESEND_API_KEY : null;
  const from = process.env.EMAIL_FROM ?? "reports@drosia.eu";
  if (!apiKey) {
    console.info(`[digest:dev] would email ${to.join(", ")} | ${subject}`);
    return NextResponse.json({ delivery: "dev", subject, recipients: to.length });
  }

  try {
    const { Resend } = await import("resend");
    const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text });
    if (error) return NextResponse.json({ delivery: "failed", error: error.message }, { status: 502 });
    return NextResponse.json({ delivery: "sent", recipients: to.length });
  } catch (e) {
    return NextResponse.json({ delivery: "failed", error: e instanceof Error ? e.message : "send failed" }, { status: 502 });
  }
}
