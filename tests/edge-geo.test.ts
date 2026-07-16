import { describe, expect, it } from "vitest";
import { edgeGeo } from "@/lib/edge-geo";

describe("edgeGeo", () => {
  it("parses country, region, decoded city, and rounded coordinates", () => {
    const geo = edgeGeo(
      new Headers({
        "x-vercel-ip-country": "gr",
        "x-vercel-ip-country-region": "l",
        "x-vercel-ip-city": "R%C3%B3dos",
        "x-vercel-ip-latitude": "36.434704",
        "x-vercel-ip-longitude": "28.217296",
      }),
    );
    expect(geo).toEqual({ country: "GR", region: "L", city: "Ródos", lat: 36.43, lng: 28.22 });
  });

  it("returns nulls when the edge provides no geo headers (e.g. localhost)", () => {
    expect(edgeGeo(new Headers())).toEqual({ country: null, region: null, city: null, lat: null, lng: null });
  });

  it("drops coordinates unless BOTH are present and in range", () => {
    expect(edgeGeo(new Headers({ "x-vercel-ip-latitude": "36.4" })).lat).toBeNull();
    const outOfRange = edgeGeo(
      new Headers({ "x-vercel-ip-latitude": "91", "x-vercel-ip-longitude": "28.2" }),
    );
    expect(outOfRange.lat).toBeNull();
    expect(outOfRange.lng).toBeNull();
    expect(edgeGeo(new Headers({ "x-vercel-ip-latitude": "junk", "x-vercel-ip-longitude": "28.2" })).lng).toBeNull();
  });

  it("keeps a malformed percent-encoding as-is instead of throwing", () => {
    expect(edgeGeo(new Headers({ "x-vercel-ip-city": "Bad%2" })).city).toBe("Bad%2");
  });

  it("length-caps city and region values", () => {
    const geo = edgeGeo(
      new Headers({ "x-vercel-ip-city": "x".repeat(200), "x-vercel-ip-country-region": "abcdefghijk" }),
    );
    expect(geo.city).toHaveLength(80);
    expect(geo.region).toHaveLength(8);
  });
});
