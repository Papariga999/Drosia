import "server-only";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Web-Push sender (the piece that was missing — subscriptions were captured but
 * never delivered). Fire-and-forget: `notifyReportFollowers` NEVER throws, so a
 * push failure can't break the status transition that triggered it. No-op when
 * VAPID isn't configured, so the app runs fine before keys are set.
 *
 * Setup (one-time):
 *   1. npx web-push generate-vapid-keys
 *   2. set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   3. apply supabase/schema.sql (adds report_follows)
 */
let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@drosia.eu";
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

interface SubRow {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Push a notification to every follower of a report. Looks up the followers'
 * device tokens (report_follows) → their browser subscriptions
 * (push_subscriptions) → sends. Subscriptions the browser has dropped (404/410)
 * are pruned so they aren't retried forever.
 */
export async function notifyReportFollowers(reportId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const admin = getSupabaseAdmin();

    const { data: follows } = await admin
      .from("report_follows")
      .select("device_token")
      .eq("report_id", reportId);
    const tokens = (follows ?? []).map((f: { device_token: string }) => f.device_token);
    if (tokens.length === 0) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, keys")
      .in("device_token", tokens);
    const list = (subs ?? []) as SubRow[];
    if (list.length === 0) return;

    const body = JSON.stringify(payload);
    const dead: string[] = [];
    await Promise.all(
      list.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
        }
      }),
    );

    if (dead.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", dead);
    }
  } catch {
    // Swallow everything — notifications must never break the caller's flow.
  }
}
