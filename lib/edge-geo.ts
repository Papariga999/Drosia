import "server-only";

/**
 * Coarse visitor geo from the hosting edge's IP-lookup headers (Vercel:
 * x-vercel-ip-country / -country-region / -city / -latitude / -longitude).
 *
 * Privacy by design, same contract as the rest of /api/track: the IP itself is
 * never stored. What Vercel derives from it and we keep is city-level only —
 * ISO country, ISO-3166-2 subdivision code, city name, and the CITY-CENTROID
 * coordinates (they describe the city, not the visitor; we still round them to
 * 2 decimals ≈ 1 km so nothing finer can ever land in the table). This matches
 * the granularity commercial analytics (incl. Vercel's own) expose.
 */
export interface EdgeGeo {
  country: string | null;
  /** ISO-3166-2 subdivision code (e.g. "L" in GR-L), without the country prefix. */
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

function roundCoord(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export function edgeGeo(headers: Headers): EdgeGeo {
  const country = (headers.get("x-vercel-ip-country") ?? "").toUpperCase().slice(0, 2) || null;
  const region = (headers.get("x-vercel-ip-country-region") ?? "").toUpperCase().slice(0, 8) || null;

  // Vercel URI-encodes non-ASCII city names (e.g. "R%C3%B3dos").
  let city: string | null = null;
  const rawCity = headers.get("x-vercel-ip-city") ?? "";
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).slice(0, 80);
    } catch {
      city = rawCity.slice(0, 80);
    }
  }

  const lat = roundCoord(headers.get("x-vercel-ip-latitude"));
  const lng = roundCoord(headers.get("x-vercel-ip-longitude"));
  const validPair = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return {
    country,
    region,
    city,
    lat: validPair ? lat : null,
    lng: validPair ? lng : null,
  };
}
