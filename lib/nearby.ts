import { distanceKm } from "./geo";

/**
 * Pre-submit duplicate suggestion (the one thing FixMyStreet does that we
 * didn't): open public reports within a small radius of the reporter's
 * position, so the same rubbish pile isn't reported many times. Pure and
 * DB-free so it's unit-testable; at launch scale the in-process filter over
 * the public view beats a PostGIS RPC on the anonymous read path — same
 * rationale as listNearbyReports in lib/reports.ts.
 */
export interface NearbyCandidate {
  status: string;
  lat: number;
  lng: number;
}

/** GPS accuracy on a phone is ±10–30 m; 100 m keeps the suggestion honest. */
export const NEARBY_RADIUS_M = 100;
export const NEARBY_LIMIT = 3;

/**
 * Open (in_review/notified — resolved piles aren't duplicate targets) reports
 * within radiusM of the point, closest first, capped at limit.
 */
export function filterNearbyOpen<T extends NearbyCandidate>(
  reports: T[],
  lat: number,
  lng: number,
  radiusM: number = NEARBY_RADIUS_M,
  limit: number = NEARBY_LIMIT,
): (T & { distance_m: number })[] {
  return reports
    .filter((r) => r.status === "in_review" || r.status === "notified")
    .map((r) => ({ ...r, distance_m: Math.round(distanceKm(lat, lng, r.lat, r.lng) * 1000) }))
    .filter((r) => r.distance_m <= radiusM)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, limit);
}
