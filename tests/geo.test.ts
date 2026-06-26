import { describe, it, expect } from "vitest";
import { inBBox, geocodeKey, type BBox } from "@/lib/geo";

const sampleBox: BBox = { minLng: 10, minLat: 50, maxLng: 15, maxLat: 55 };

describe("geo helpers", () => {
  it("accepts a point inside a bounding box", () => {
    expect(inBBox(52.52, 13.405, sampleBox)).toBe(true);
  });
  it("rejects a point outside a bounding box", () => {
    expect(inBBox(48.137, 11.576, sampleBox)).toBe(false);
  });
  it("builds a stable geocode cache key", () => {
    expect(geocodeKey(37.98381, 23.72752)).toBe("37.9838,23.7275");
  });
});
