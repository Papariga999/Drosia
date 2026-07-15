import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";
import { ensureKnownDevice } from "@/lib/anon-device";
import { readJsonBody, RequestBodyError } from "@/lib/http-body";
import { isSafePushEndpoint } from "@/lib/push/endpoint";

export const runtime = "nodejs";

/**
 * Store a login-free Web Push subscription and, optionally, a report follow.
 * Device tokens are random browser-local identifiers, not accounts or PII.
 */
const bodySchema = z
  .object({
    deviceToken: z.string().trim().regex(/^[A-Za-z0-9_-]{16,128}$/),
    subscription: z
      .object({
        endpoint: z.string().url().max(1000).refine(isSafePushEndpoint, "Unsupported push endpoint."),
        keys: z
          .object({
            p256dh: z.string().trim().regex(/^[A-Za-z0-9_-]{40,255}$/),
            auth: z.string().trim().regex(/^[A-Za-z0-9_-]{8,255}$/),
          })
          .strict(),
      })
      .strict(),
    areaAuthorityId: z.string().uuid().optional(),
    reportToken: z.string().trim().regex(/^[0-9a-f]{8,64}$/i).optional(),
  })
  .strict();

function configured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!url && !url.includes("YOUR_PROJECT") && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function POST(req: Request): Promise<Response> {
  if (!configured()) return NextResponse.json({ error: "Backend not configured." }, { status: 503 });

  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`push-sub:${ip}`, 20, 10 * 60 * 1000, {
    failClosedInProduction: true,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const { deviceToken, subscription, areaAuthorityId, reportToken } = parsed.data;

  // Minting arbitrary identities is separately budgeted so rotating the client
  // token cannot bypass the ordinary request rate limit.
  const device = await ensureKnownDevice(deviceToken, ip);
  if (!device.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(device.retryAfterSeconds) } },
    );
  }

  const admin = getSupabaseAdmin();
  if (areaAuthorityId) {
    const { data: authority, error: authorityError } = await admin
      .from("authorities")
      .select("id")
      .eq("id", areaAuthorityId)
      .eq("is_active", true)
      .eq("is_test", false)
      .maybeSingle<{ id: string }>();
    if (authorityError) return NextResponse.json({ error: "Subscribe failed." }, { status: 500 });
    if (!authority) return NextResponse.json({ error: "Authority not found." }, { status: 400 });
  }

  // Resolve and authorize a requested follow before claiming success. Private
  // reports may only be followed by their submitting device; everyone may
  // follow a report already present in the privacy-safe public view.
  let followReportId: string | null = null;
  if (reportToken) {
    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id, author_token, status, is_test")
      .eq("public_token", reportToken)
      .maybeSingle<{
        id: string;
        author_token: string | null;
        status: string;
        is_test: boolean;
      }>();
    if (reportError) return NextResponse.json({ error: "Follow failed." }, { status: 500 });

    const ownsPrivateReport =
      report?.author_token === deviceToken && report.status !== "rejected" && !report.is_test;
    let isPublished = false;
    if (report && !ownsPrivateReport) {
      const { data: published, error: publishedError } = await admin
        .from("v_public_reports")
        .select("id")
        .eq("id", report.id)
        .maybeSingle<{ id: string }>();
      if (publishedError) return NextResponse.json({ error: "Follow failed." }, { status: 500 });
      isPublished = !!published;
    }
    if (!report || (!ownsPrivateReport && !isPublished)) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    followReportId = report.id;
  }

  const { error: subscriptionError } = await admin
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
  if (subscriptionError) {
    console.error("[/api/push/subscribe] subscription upsert failed:", subscriptionError.message);
    return NextResponse.json({ error: "Subscribe failed." }, { status: 500 });
  }

  if (followReportId) {
    const { error: followError } = await admin
      .from("report_follows")
      .upsert({ report_id: followReportId, device_token: deviceToken } as never, {
        onConflict: "report_id,device_token",
      });
    if (followError) {
      console.error("[/api/push/subscribe] follow upsert failed:", followError.message);
      return NextResponse.json({ error: "Follow failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
