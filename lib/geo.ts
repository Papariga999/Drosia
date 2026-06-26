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
