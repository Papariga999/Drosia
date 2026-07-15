import { describe, expect, it } from "vitest";
import { parseReportPoint } from "@/lib/report-point";

describe("parseReportPoint", () => {
  it("reads GeoJSON points", () => {
    expect(parseReportPoint({ type: "Point", coordinates: [13.405, 52.52] })).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("reads serialized GeoJSON and EWKT points", () => {
    expect(parseReportPoint('{"type":"Point","coordinates":[28.1,36.4]}')).toEqual({
      lat: 36.4,
      lng: 28.1,
    });
    expect(parseReportPoint("SRID=4326;POINT(13.405 52.52)")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("rejects malformed and out-of-range points", () => {
    expect(parseReportPoint("POINT(181 52)")).toBeNull();
    expect(parseReportPoint({ type: "LineString", coordinates: [] })).toBeNull();
    expect(parseReportPoint(null)).toBeNull();
  });
});
