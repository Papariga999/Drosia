/**
 * Lightweight geo helpers.
 * Country and authority matching live in PostGIS. The bounding-box helper is a
 * generic utility for pre-filtering or tests, not a submit gate.
 */
export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function inBBox(lat: number, lng: number, b: BBox): boolean {
  return lng >= b.minLng && lng <= b.maxLng && lat >= b.minLat && lat <= b.maxLat;
}

export function roundCoord(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** geocode_cache key from rounded coordinates. */
export function geocodeKey(lat: number, lng: number): string {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Great-circle (haversine) distance in km on WGS84 — plenty accurate at
 * municipal scale for UI-level hints ("next report · 320 m"). Authoritative
 * geometry (geofence, authority routing) stays in PostGIS.
 */
const EARTH_RADIUS_KM = 6371;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "320 m" under 1 km, "1.2 km" under 10, else "23 km" — SI, locale-neutral. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
