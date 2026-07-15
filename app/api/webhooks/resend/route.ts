import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readBodyBytes, RequestBodyError } from "@/lib/http-body";
import { verifyBearerHeader, verifySvixSignature } from "@/lib/webhooks/resend";
import { notifyForwardedReportFollowers } from "@/lib/push/report-status";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_BY_EVENT = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.complained": "complained",
} as const;

const eventSchema = z
  .object({
    type: z.string().min(1).max(100),
    created_at: z.string().datetime({ offset: true }),
    data: z
      .object({
        email_id: z.string().min(1).max(200).optional(),
        tags: z.record(z.string().max(200)).optional(),
        bounce: z.object({ message: z.string().max(2000).optional() }).passthrough().optional(),
        error: z
          .union([
            z.string().max(2000),
            z.object({ message: z.string().max(2000).optional() }).passthrough(),
          ])
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

function eventError(event: z.infer<typeof eventSchema>): string | null {
  if (event.data.bounce?.message) return event.data.bounce.message;
  if (typeof event.data.error === "string") return event.data.error;
  return event.data.error?.message ?? null;
}

export async function POST(req: Request): Promise<Response> {
  let rawBody: string;
  try {
    const bytes = await readBodyBytes(req, MAX_WEBHOOK_BYTES);
    rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }

  // Once a provider signing secret is configured it is the only accepted auth
  // method. Bearer is a migration/development fallback, not a bypass for a bad
  // Svix signature.
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET;
  const bearerSecret = process.env.WEBHOOK_SECRET;
  const signed = !!signingSecret && verifySvixSignature(req.headers, rawBody, signingSecret);
  const bearer =
    !signingSecret &&
    !!bearerSecret &&
    verifyBearerHeader(req.headers.get("authorization"), bearerSecret);
  if (!signed && !bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawEvent: unknown;
  try {
    rawEvent = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(rawEvent);
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const event = parsed.data;

  const status = STATUS_BY_EVENT[event.type as keyof typeof STATUS_BY_EVENT];
  if (!status) return NextResponse.json({ ok: true, ignored: true });
  const emailId = event.data.email_id;
  if (!emailId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const svixId = req.headers.get("svix-id");
  const eventId = svixId || `bearer:${createHash("sha256").update(rawBody).digest("hex")}`;
  const taggedLogId = event.data.tags?.delivery_log_id;
  const deliveryLogId = taggedLogId && UUID.test(taggedLogId) ? taggedLogId : null;
  const isAuthorityDelivery =
    event.data.tags?.drosia_kind === "authority_report" || taggedLogId !== undefined;

  const { data, error } = await getSupabaseAdmin().rpc("apply_delivery_webhook", {
    p_provider: "resend",
    p_event_id: eventId,
    p_delivery_log_id: deliveryLogId,
    p_provider_message_id: emailId,
    p_event_type: event.type,
    p_status: status,
    p_error: eventError(event),
    p_event_at: event.created_at,
  } as never);
  if (error) {
    console.error("[/api/webhooks/resend] apply failed:", error.message);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 503 });
  }

  const result = data as string | null;
  if (result === "not_found" && isAuthorityDelivery) {
    // The send may have completed before its log id/provider id was committed.
    // Ask Resend to retry rather than acknowledging and losing the event.
    return NextResponse.json({ error: "Delivery log not ready." }, { status: 503 });
  }
  if (result === "not_found") return NextResponse.json({ ok: true, ignored: true });
  if (result === "applied" && status === "delivered") {
    const { data: log } = await getSupabaseAdmin()
      .from("delivery_logs")
      .select("report_id")
      .eq("provider_message_id", emailId)
      .maybeSingle<{ report_id: string }>();
    if (log?.report_id) await notifyForwardedReportFollowers(log.report_id);
  }
  return NextResponse.json({ ok: true, result });
}
