import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/resend — deliverability feedback (P0: never a silent failure).
 * Resend posts email.delivered / email.bounced / email.complained events; we map
 * them onto the matching delivery_logs row (by provider_message_id = email id) so
 * the admin delivery monitor shows real status and bounces surface immediately.
 *
 * Auth: prefer Resend's Svix signature (RESEND_WEBHOOK_SECRET = whsec_…). If that
 * isn't configured, fall back to a shared Bearer WEBHOOK_SECRET. With neither set
 * (and not in dev) the endpoint refuses — an unauthenticated webhook would let
 * anyone forge delivery state.
 */
const STATUS_BY_EVENT: Record<string, "delivered" | "bounced" | "complained" | "sent"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.sent": "sent",
};

function verifyBearer(req: Request): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Manual Svix verification (no extra dependency). */
function verifySvix(req: Request, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatureHeader = req.headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  // Header is a space-separated list of "v1,<base64sig>" entries.
  for (const part of signatureHeader.split(" ")) {
    const sig = part.split(",")[1];
    if (!sig) continue;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();

  const authed =
    (process.env.RESEND_WEBHOOK_SECRET && verifySvix(req, rawBody)) ||
    (process.env.WEBHOOK_SECRET && verifyBearer(req));
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; bounce?: { message?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const status = event.type ? STATUS_BY_EVENT[event.type] : undefined;
  const emailId = event.data?.email_id;
  // Ack unknown event types / missing id so Resend doesn't retry forever.
  if (!status || !emailId) return NextResponse.json({ ok: true, ignored: true });

  const update: { status: string; error?: string } = { status };
  if (status === "bounced" || status === "complained") {
    update.error = event.data?.bounce?.message ?? event.type;
  }

  const { error } = await getSupabaseAdmin()
    .from("delivery_logs")
    .update(update as never)
    .eq("provider_message_id", emailId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
