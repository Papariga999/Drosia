/** Parse the GeoJSON/EWKT point shapes PostgREST may return for PostGIS geography. */
export function parseReportPoint(value: unknown): { lat: number; lng: number } | null {
  const validPoint = (lng: number, lat: number) =>
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
      ? { lng, lat }
      : null;
  let candidate = value;
  if (typeof candidate === "string" && candidate.trim().startsWith("{")) {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }

  if (candidate && typeof candidate === "object") {
    const coordinates = (candidate as { coordinates?: unknown }).coordinates;
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      return validPoint(coordinates[0], coordinates[1]);
    }
  }

  if (typeof candidate === "string") {
    const match = candidate.match(/(?:SRID=\d+;)?POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (match) return validPoint(Number(match[1]), Number(match[2]));
  }
  return null;
}
