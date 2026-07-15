import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deliverReport, type DeliveryChannel } from "@/lib/providers/deliver";
import { notifyForwardedReportFollowers } from "@/lib/push/report-status";

export interface DeliverAndLogResult {
  status: string; // report status after the attempt
  delivery:
    | "sent"
    | "failed"
    | "awaiting_channel"
    | "not_found"
    | "invalid_state"
    | "log_failed"
    | "sent_status_failed";
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
  if (report.status !== "in_review" && report.status !== "notified") {
    return {
      status: report.status,
      delivery: "invalid_state",
      error: `Cannot deliver a report in status '${report.status}'.`,
    };
  }

  let recipient: string | null = null;
  let channel: DeliveryChannel = "none";
  if (report.authority_id) {
    const { data: authority } = await admin
      .from("authorities")
      .select("email_official, open311_endpoint, delivery_channel")
      .eq("id", report.authority_id)
      .maybeSingle<{
        email_official: string | null;
        open311_endpoint: string | null;
        delivery_channel: string;
      }>();
    channel = (authority?.delivery_channel as DeliveryChannel) ?? "none";
    recipient =
      channel === "open311" ? authority?.open311_endpoint ?? null : authority?.email_official ?? null;
  }

  if (channel === "none" || !recipient) {
    const { error: logError } = await admin.from("delivery_logs").insert({
      report_id: report.id,
      channel,
      recipient,
      status: "failed",
      error: "AWAITING_AUTHORITY_CHANNEL",
    } as never);
    if (logError) {
      return {
        status: report.status,
        delivery: "log_failed",
        error: `Could not record missing authority channel: ${logError.message}`,
      };
    }
    return { status: report.status, delivery: "awaiting_channel" };
  }

  const { data: queuedLog, error: queueError } = await admin
    .from("delivery_logs")
    .insert({
      report_id: report.id,
      channel,
      recipient,
      status: "queued",
      error: null,
    } as never)
    .select("id")
    .single<{ id: string }>();
  if (queueError || !queuedLog) {
    return {
      status: report.status,
      delivery: "log_failed",
      error: `Delivery not attempted because logging failed: ${queueError?.message ?? "no log id"}`,
    };
  }

  const result = await deliverReport({
    channel,
    reportId: report.id,
    deliveryLogId: queuedLog.id,
    reportToken: report.public_token,
    category: report.category,
    recipient,
    locale: report.locale,
  });

  const { error: logUpdateError } = await admin
    .from("delivery_logs")
    .update({
      provider_message_id: result.providerMessageId ?? null,
      status: result.status === "sent" ? "sent" : "failed",
      error: result.error ?? null,
    } as never)
    .eq("id", queuedLog.id)
    .is("provider_status_at", null);
  if (logUpdateError) {
    return {
      status: report.status,
      delivery: "log_failed",
      error: `Delivery completed but its log could not be finalized: ${logUpdateError.message}`,
    };
  }

  const { data: finalLog, error: finalLogError } = await admin
    .from("delivery_logs")
    .select("status, error")
    .eq("id", queuedLog.id)
    .single<{ status: string; error: string | null }>();
  if (finalLogError || !finalLog) {
    return {
      status: report.status,
      delivery: "log_failed",
      error: `Delivery completed but its final log could not be read: ${finalLogError?.message ?? "missing log"}`,
    };
  }

  const accepted = ["sent", "delivered", "delayed"].includes(finalLog.status);
  if (!accepted) {
    return {
      status: report.status,
      delivery: "failed",
      error: finalLog.error ?? result.error ?? `Provider status: ${finalLog.status}`,
    };
  }

  if (channel === "open311") {
    if (report.status === "in_review") {
      const { error: statusError } = await admin
        .from("reports")
        .update({ status: "notified", notified_at: new Date().toISOString() } as never)
        .eq("id", report.id);
      if (statusError) {
        return {
          status: report.status,
          delivery: "sent_status_failed",
          error: `Delivery was sent but report status could not be updated: ${statusError.message}`,
        };
      }

      await notifyForwardedReportFollowers(report.id);
    }
    return { status: "notified", delivery: "sent" };
  }

  // Resend's send API only confirms acceptance. `email.delivered` advances the
  // report to notified transactionally in apply_delivery_webhook().
  const { data: current } = await admin
    .from("reports")
    .select("status")
    .eq("id", report.id)
    .maybeSingle<{ status: string }>();
  return { status: current?.status ?? report.status, delivery: "sent" };
}
