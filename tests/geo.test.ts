import { describe, it, expect } from "vitest";
import { inBBox, geocodeKey, distanceKm, formatDistance, type BBox } from "@/lib/geo";

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

describe("distanceKm (haversine)", () => {
  it("is zero for identical points", () => {
    expect(distanceKm(36.4341, 28.2176, 36.4341, 28.2176)).toBe(0);
  });
  it("matches a known distance (Rhodes town → Lindos ≈ 36 km)", () => {
    const d = distanceKm(36.4341, 28.2176, 36.0919, 28.0854);
    expect(d).toBeGreaterThan(34);
    expect(d).toBeLessThan(42);
  });
  it("is symmetric", () => {
    const ab = distanceKm(36.4341, 28.2176, 36.0919, 28.0854);
    const ba = distanceKm(36.0919, 28.0854, 36.4341, 28.2176);
    expect(ab).toBeCloseTo(ba, 10);
  });
});

describe("formatDistance", () => {
  it("renders metres below 1 km, rounded to 10 m with a 10 m floor", () => {
    expect(formatDistance(0.32)).toBe("320 m");
    expect(formatDistance(0.001)).toBe("10 m");
    expect(formatDistance(0.994)).toBe("990 m");
  });
  it("renders one decimal below 10 km, whole km above", () => {
    expect(formatDistance(4.23)).toBe("4.2 km");
    expect(formatDistance(111.4)).toBe("111 km");
  });
});
