import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/push/subscribe — store a Web-Push subscription (Phase 3). Login-free:
 * keyed by the anonymous device token + the browser push endpoint (unique). No
 * email, no fingerprinting. Idempotent: re-subscribing upserts on endpoint.
 * Sending notifications (VAPID) is a separate concern; this only captures the
 * subscription so a later sender can reach per-report / area followers.
 */
const bodySchema = z.object({
  deviceToken: z.string().trim().min(8).max(128),
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().trim().min(1).max(255),
      auth: z.string().trim().min(1).max(255),
    }),
  }),
  areaAuthorityId: z.string().uuid().optional(),
});

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function POST(req: Request): Promise<Response> {
  if (!configured()) return NextResponse.json({ error: "Backend not configured." }, { status: 503 });

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`push-sub:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const { deviceToken, subscription, areaAuthorityId } = parsed.data;

  const { error } = await getSupabaseAdmin()
    .from("push_subscriptions")
    .upsert(
      {
        device_token: deviceToken,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        area_authority_id: areaAuthorityId ?? null,
      } as never,
      { onConflict: "endpoint" },
    );

  if (error) return NextResponse.json({ error: "Subscribe failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
