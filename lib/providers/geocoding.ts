/**
 * Reverse-geocoding provider interface — so Nominatim can be swapped for a paid
 * provider without touching callers. Real implementation + geocode_cache in Phase 1.
 */
export interface ReverseGeocodeResult {
  displayName: string | null;
  raw: unknown;
}

export interface ReverseGeocoder {
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult>;
}

class NominatimGeocoder implements ReverseGeocoder {
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    // TODO(phase1): real Nominatim call, ToS-compliant User-Agent + rate limit,
    // cache via geocode_cache (lib/geo.ts geocodeKey).
    void lat;
    void lng;
    throw new Error("NominatimGeocoder.reverseGeocode not implemented (Phase 1).");
  }
}

let _geocoder: ReverseGeocoder | null = null;
export function getGeocoder(): ReverseGeocoder {
  if (!_geocoder) _geocoder = new NominatimGeocoder();
  return _geocoder;
}

export function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  return getGeocoder().reverseGeocode(lat, lng);
}
