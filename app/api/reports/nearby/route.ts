import { NextResponse } from "next/server";
import { listPublicReports } from "@/lib/reports";
import { filterNearbyOpen } from "@/lib/nearby";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/reports/nearby?lat=&lng=
 *
 * Pre-submit duplicate check: up to 3 open public reports within 100 m of the
 * given point, closest first. Reads only the public view data (anonymized
 * photos, no author_token, no originals) — the same rows the map already
 * shows, so nothing new is exposed. Cookieless; light IP rate limit.
 */
export async function GET(req: Request): Promise<Response> {
  const ip = clientIp(req.headers);
  if (!rateLimit(`nearby:${ip}`, 120, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const reports = filterNearbyOpen(await listPublicReports(200), lat, lng).map((r) => ({
    public_token: r.public_token,
    category: r.category,
    status: r.status,
    created_at: r.created_at,
    notified_at: r.notified_at,
    resolved_at: r.resolved_at,
    photo_url: r.photo_url ?? null,
    distance_m: r.distance_m,
  }));

  return NextResponse.json({ reports });
}
