/**
 * Lightweight geo helpers.
 * AUTHORITATIVE geofence = PostGIS ST_Covers(country.boundary, point) at submit time (Phase 1).
 * The bounding box here is only a cheap pre-filter / test aid — NOT the geofence itself.
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
