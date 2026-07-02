import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable } from "@/lib/rate-limit";

/**
 * Anonymous-device gate for engagement writes (votes, push subscriptions).
 *
 * The voter/device token is client-generated, so on its own it is free to
 * fabricate: one IP could mint a fresh token per vote and turn the per-IP vote
 * limit into a vote-inflation budget. The fix is to make the IDENTITY the
 * scarce resource, not the vote: a token must exist in anon_devices before it
 * can vote, and REGISTERING a new device consumes a much stricter per-IP budget
 * than voting does. A real person registers once (their token persists in
 * localStorage) and never pays again; an attacker now needs a fresh IP per
 * handful of fake identities instead of per ~30 votes.
 *
 * The budget is deliberately not 1–3/day: Greek mobile carriers use CGNAT, so
 * one IP can legitimately front many first-time visitors in a day.
 *
 * No PII, no fingerprinting: the row is just the random token + timestamps.
 */
export const NEW_DEVICE_LIMIT = 10; // new device identities per IP…
export const NEW_DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000; // …per day

export type DeviceGateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Ensure a device token is registered, registering it if the IP's budget
 * allows. Known devices always pass (and bump last_seen, best-effort).
 */
export async function ensureKnownDevice(deviceToken: string, ip: string): Promise<DeviceGateResult> {
  const admin = getSupabaseAdmin();

  const { data: existing } = await admin
    .from("anon_devices")
    .select("id")
    .eq("device_token", deviceToken)
    .maybeSingle<{ id: string }>();

  if (existing) {
    void admin
      .from("anon_devices")
      .update({ last_seen: new Date().toISOString() } as never)
      .eq("id", existing.id)
      .then(undefined, () => {});
    return { ok: true };
  }

  const limit = await rateLimitDurable(`device-reg:${ip}`, NEW_DEVICE_LIMIT, NEW_DEVICE_WINDOW_MS);
  if (!limit.ok) return { ok: false, retryAfterSeconds: limit.retryAfterSeconds };

  // Concurrent first-use of the same token is fine: the unique constraint makes
  // the second insert a no-op conflict, and both requests proceed as registered.
  const { error } = await admin
    .from("anon_devices")
    .upsert({ device_token: deviceToken } as never, { onConflict: "device_token", ignoreDuplicates: true });
  if (error) return { ok: false, retryAfterSeconds: 60 };

  return { ok: true };
}

/**
 * Register a device without consuming the per-IP budget. Used by the report
 * submit route: submitting is already expensive (photos, 5/10min IP limit), and
 * a reporter's device becoming vote-eligible is exactly what we want.
 */
export async function registerDevice(deviceToken: string): Promise<void> {
  if (!deviceToken) return;
  await getSupabaseAdmin()
    .from("anon_devices")
    .upsert({ device_token: deviceToken } as never, { onConflict: "device_token", ignoreDuplicates: true })
    .then(undefined, () => {});
}
