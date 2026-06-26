import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deliverReport, type DeliveryChannel } from "@/lib/providers/deliver";

export interface DeliverAndLogResult {
  status: string; // report status after the attempt
  delivery: "sent" | "failed" | "awaiting_channel" | "not_found";
  error?: string;
}

/**
 * Resolve a report's authority channel, deliver, write delivery_logs, and bump
 * the report to 'notified' on success. Shared by approve and resend so the
 * logging + status transition stay identical. NEVER fails silently — every
 * attempt with a usable channel is written to delivery_logs.
 */
export async function deliverAndLog(reportId: string): Promise<DeliverAndLogResult> {
  const admin = getSupabaseAdmin();

  const { data: report } = await admin
    .from("reports")
    .select("id, public_token, category, locale, authority_id, status")
    .eq("id", reportId)
    .maybeSingle<{
      id: string;
      public_token: string;
      category: string;
      locale: string;
      authority_id: string | null;
      status: string;
    }>();

  if (!report) return { status: "", delivery: "not_found" };

  let recipient: string | null = null;
  let channel: DeliveryChannel = "none";
  if (report.authority_id) {
    const { data: authority } = await admin
      .from("authorities")
      .select("email_official, delivery_channel")
      .eq("id", report.authority_id)
      .maybeSingle<{ email_official: string | null; delivery_channel: string }>();
    recipient = authority?.email_official ?? null;
    channel = (authority?.delivery_channel as DeliveryChannel) ?? "none";
  }

  if (channel === "none" || (channel === "email" && !recipient)) {
    return { status: report.status, delivery: "awaiting_channel" };
  }

  const result = await deliverReport({
    channel,
    reportId: report.id,
    reportToken: report.public_token,
    category: report.category,
    recipient,
    locale: report.locale,
  });

  await admin.from("delivery_logs").insert({
    report_id: report.id,
    channel,
    recipient,
    provider_message_id: result.providerMessageId ?? null,
    status: result.status === "sent" ? "sent" : "failed",
    error: result.error ?? null,
  } as never);

  if (result.status === "sent") {
    if (report.status !== "notified" && report.status !== "resolved") {
      await admin
        .from("reports")
        .update({ status: "notified", notified_at: new Date().toISOString() } as never)
        .eq("id", report.id);
    }
    return { status: "notified", delivery: "sent" };
  }

  return { status: report.status, delivery: "failed", error: result.error };
}
