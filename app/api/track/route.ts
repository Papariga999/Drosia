import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/http-body";
import { edgeGeo } from "@/lib/edge-geo";

export const runtime = "nodejs";

/**
 * POST /api/track — first-party, cookieless page-view ingest for the PUBLIC app.
 *
 * Privacy by design: we never store the IP. A coarse country is read from the
 * edge header and the IP is discarded. `sid` is a random, session-scoped id
 * (not an identity, not a fingerprint). Bots are dropped. Best-effort: any
 * failure (incl. table not migrated yet) is swallowed so the page never breaks.
 */
const LOCALES = ["el", "en", "de"];
// Allowlist of analytics events (anything else is coerced to 'pageview').
const EVENTS = ["pageview", "report_start", "photo_added", "geolocate", "submit_success", "submit_fail", "share_click", "map_open", "session_duration", "nearby_next", "nearby_dupe_shown", "nearby_dupe_follow"];
const SHARE_CHANNELS = ["whatsapp", "facebook", "x", "copy", "native", "other"];
const MAX_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|pingdom|gtmetrix|uptime|monitor|preview|curl|wget/i;
const MOBILE_RE = /mobile|android|iphone|ipad|ipod|iemobile|opera mini/i;

function deviceClass(ua: string): "bot" | "mobile" | "desktop" {
  if (!ua || BOT_RE.test(ua)) return "bot";
  return MOBILE_RE.test(ua) ? "mobile" : "desktop";
}

function osFamily(ua: string, platformHeader: string | null): "windows" | "macos" | "android" | "ios" | "linux" | "other" {
  const platform = (platformHeader ?? "").replaceAll('"', "").toLowerCase();
  const haystack = `${platform} ${ua}`.toLowerCase();
  if (haystack.includes("android")) return "android";
  if (/iphone|ipad|ipod|\bios\b/.test(haystack) || (haystack.includes("macintosh") && /\bmobile\b/.test(haystack))) return "ios";
  if (haystack.includes("windows")) return "windows";
  if (haystack.includes("mac os") || haystack.includes("macintosh") || haystack.includes("macos")) return "macos";
  if (haystack.includes("linux")) return "linux";
  return "other";
}

/** Best traffic-source attribution: utm_source wins, else the external referrer host, else direct. */
function normalizeSource(path: string, ref: string, host: string | null): string {
  try {
    const utm = new URL(path, "http://x").searchParams.get("utm_source");
    if (utm) return utm.toLowerCase().slice(0, 40);
  } catch {
    /* ignore */
  }
  if (ref) {
    try {
      const rh = new URL(ref).host.replace(/^www\./, "");
      const self = (host ?? "").replace(/^www\./, "");
      if (rh && rh !== self) return rh.slice(0, 60);
    } catch {
      /* ignore */
    }
  }
  return "direct";
}

export async function POST(req: Request): Promise<Response> {
  // Light per-instance brake; never 429 a beacon — just drop silently.
  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`track:${ip}`, 240, 10 * 60 * 1000, {
    failClosedInProduction: true,
  });
  if (!limit.ok) return new NextResponse(null, { status: 204 });

  const ua = req.headers.get("user-agent") ?? "";
  const device = deviceClass(ua);
  if (device === "bot") return new NextResponse(null, { status: 204 });

  let body: { event?: string; path?: string; ref?: string; sid?: string; locale?: string; shareChannel?: string; durationMs?: number };
  try {
    body = await readJsonBody(req, 8 * 1024);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const event = typeof body.event === "string" && EVENTS.includes(body.event) ? body.event : "pageview";
  const rawPath = typeof body.path === "string" ? body.path : "/";
  let pathname = "/";
  try {
    pathname = new URL(rawPath, "http://x").pathname.slice(0, 200);
  } catch {
    /* keep "/" */
  }

  const tokenMatch = pathname.match(/^\/r\/([0-9a-f]{8,32})/i);
  const reportToken = tokenMatch ? tokenMatch[1]!.toLowerCase() : null;

  const host = req.headers.get("host");
  const source = normalizeSource(rawPath, typeof body.ref === "string" ? body.ref : "", host);
  // City-level edge geo (country/region/city + rounded city-centroid coords);
  // never the IP — see lib/edge-geo.ts.
  const geo = edgeGeo(req.headers);
  const country = geo.country;
  const os = osFamily(ua, req.headers.get("sec-ch-ua-platform"));
  const sid = typeof body.sid === "string" ? body.sid.slice(0, 64) : null;
  const locale = typeof body.locale === "string" && LOCALES.includes(body.locale) ? body.locale : null;
  const shareChannel =
    event === "share_click" && typeof body.shareChannel === "string" && SHARE_CHANNELS.includes(body.shareChannel)
      ? body.shareChannel
      : null;
  const durationMs =
    event === "session_duration" && typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
      ? Math.max(0, Math.min(MAX_SESSION_DURATION_MS, Math.round(body.durationMs)))
      : null;

  const admin = getSupabaseAdmin();
  try {
    const row = { event, path: pathname, report_token: reportToken, source, country, region: geo.region, city: geo.city, geo_lat: geo.lat, geo_lng: geo.lng, device, os, share_channel: shareChannel, duration_ms: durationMs, sid, locale };
    const { error } = await admin.from("web_events").insert(row as never);
    if (error && /os|share_channel|duration_ms|region|city|geo_lat|geo_lng|schema cache|column|PGRST204/i.test(`${error.code ?? ""} ${error.message}`)) {
      await admin
        .from("web_events")
        .insert({ event, path: pathname, report_token: reportToken, source, country, device, sid, locale } as never);
    }
  } catch {
    /* table not migrated yet / transient — analytics is best-effort */
  }

  // Opportunistic hygiene (no cron): occasionally roll up daily aggregates and
  // purge raw events older than the retention window. Best-effort, fire-and-forget.
  if (Math.random() < 0.003) {
    void admin.rpc("web_events_maintenance").then(undefined, () => {});
  }

  return new NextResponse(null, { status: 204 });
}
