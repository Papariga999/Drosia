import { describe, it, expect } from "vitest";
import { filterNearbyOpen, NEARBY_LIMIT, NEARBY_RADIUS_M } from "@/lib/nearby";

/**
 * Pre-submit duplicate suggestion. ~1° latitude ≈ 111 km, so 0.0005° ≈ 55 m
 * and 0.002° ≈ 222 m — comfortably inside / outside the 100 m radius.
 */
const AT = { lat: 36.3461, lng: 28.1233 }; // Rhodes-ish

function report(over: Partial<{ status: string; lat: number; lng: number; public_token: string }>) {
  return { status: "notified", lat: AT.lat, lng: AT.lng, public_token: "t", ...over };
}

describe("filterNearbyOpen", () => {
  it("returns open reports inside the radius, closest first, with distance_m", () => {
    const near = report({ public_token: "near", lat: AT.lat + 0.0002 }); // ~22 m
    const nearer = report({ public_token: "nearer", lat: AT.lat + 0.0001 }); // ~11 m
    const far = report({ public_token: "far", lat: AT.lat + 0.002 }); // ~222 m
    const out = filterNearbyOpen([near, far, nearer], AT.lat, AT.lng);
    expect(out.map((r) => r.public_token)).toEqual(["nearer", "near"]);
    expect(out[0]!.distance_m).toBeLessThan(out[1]!.distance_m);
    expect(out.every((r) => r.distance_m <= NEARBY_RADIUS_M)).toBe(true);
  });

  it("excludes resolved and pending reports — only open ones are duplicate targets", () => {
    const rows = [
      report({ public_token: "resolved", status: "resolved" }),
      report({ public_token: "pending", status: "submitted" }),
      report({ public_token: "open-review", status: "in_review" }),
      report({ public_token: "open-notified", status: "notified" }),
    ];
    const out = filterNearbyOpen(rows, AT.lat, AT.lng);
    expect(out.map((r) => r.public_token).sort()).toEqual(["open-notified", "open-review"]);
  });

  it("caps the suggestion list at NEARBY_LIMIT", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      report({ public_token: `r${i}`, lat: AT.lat + i * 0.00001 }),
    );
    expect(filterNearbyOpen(rows, AT.lat, AT.lng)).toHaveLength(NEARBY_LIMIT);
  });

  it("returns empty when nothing is within the radius", () => {
    const rows = [report({ lat: AT.lat + 0.01 })]; // ~1.1 km
    expect(filterNearbyOpen(rows, AT.lat, AT.lng)).toEqual([]);
  });
});
