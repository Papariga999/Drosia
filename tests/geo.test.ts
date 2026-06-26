import { describe, it, expect } from "vitest";
import { inBBox, geocodeKey, type BBox } from "@/lib/geo";

const launchCountryFixture: BBox = { minLng: 19.3, minLat: 34.8, maxLng: 29.7, maxLat: 41.8 };

// Pre-filter only. The authoritative geofence is PostGIS ST_Covers at submit (Phase 1).
describe("geo pre-filter", () => {
  it("accepts Athens", () => {
    expect(inBBox(37.9838, 23.7275, launchCountryFixture)).toBe(true);
  });
  it("rejects Berlin", () => {
    expect(inBBox(52.52, 13.405, launchCountryFixture)).toBe(false);
  });
  it("rejects a far-west Mediterranean point", () => {
    expect(inBBox(35.0, 10.0, launchCountryFixture)).toBe(false);
  });
  it("builds a stable geocode cache key", () => {
    expect(geocodeKey(37.98381, 23.72752)).toBe("37.9838,23.7275");
  });
});
