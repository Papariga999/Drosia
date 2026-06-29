import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|pingdom|gtmetrix|uptime|monitor|preview|curl|wget/i;
const MOBILE_RE = /mobile|android|iphone|ipad|ipod|iemobile|opera mini/i;

function deviceClass(ua: string): "bot" | "mobile" | "desktop" {
  if (!ua || BOT_RE.test(ua)) return "bot";
  return MOBILE_RE.test(ua) ? "mobile" : "desktop";
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
  if (!rateLimit(`track:${ip}`, 240, 10 * 60 * 1000).ok) return new NextResponse(null, { status: 204 });

  const ua = req.headers.get("user-agent") ?? "";
  const device = deviceClass(ua);
  if (device === "bot") return new NextResponse(null, { status: 204 });

  let body: { path?: string; ref?: string; sid?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

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
  const country = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase().slice(0, 2) || null;
  const sid = typeof body.sid === "string" ? body.sid.slice(0, 64) : null;
  const locale = typeof body.locale === "string" && LOCALES.includes(body.locale) ? body.locale : null;

  try {
    await getSupabaseAdmin()
      .from("web_events")
      .insert({ event: "pageview", path: pathname, report_token: reportToken, source, country, device, sid, locale } as never);
  } catch {
    /* table not migrated yet / transient — analytics is best-effort */
  }

  return new NextResponse(null, { status: 204 });
}
