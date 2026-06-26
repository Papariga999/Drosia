import { describe, it, expect } from "vitest";
import {
  reportFieldsSchema,
  validatePhotos,
  MAX_PHOTO_BYTES,
} from "@/lib/report-intake";

const base = {
  lat: "37.9838",
  lng: "23.7275",
  category: "illegal_dump",
  description: "Pile of waste by the road",
  locale: "el",
  consent: "true",
  authorToken: "dev-abc",
  website: "",
};

describe("report field validation", () => {
  it("accepts a well-formed submission", () => {
    const r = reportFieldsSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBeCloseTo(37.9838);
      expect(r.data.category).toBe("illegal_dump");
    }
  });

  it("rejects an unknown category", () => {
    expect(reportFieldsSchema.safeParse({ ...base, category: "nukes" }).success).toBe(false);
  });

  it("rejects descriptions over 500 chars", () => {
    expect(reportFieldsSchema.safeParse({ ...base, description: "x".repeat(501) }).success).toBe(false);
  });

  it("requires upload consent", () => {
    expect(reportFieldsSchema.safeParse({ ...base, consent: "false" }).success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(reportFieldsSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(reportFieldsSchema.safeParse({ ...base, lat: "200" }).success).toBe(false);
  });

  it("accepts valid worldwide coordinates", () => {
    expect(reportFieldsSchema.safeParse({ ...base, lat: "52.52", lng: "13.405" }).success).toBe(true);
    expect(reportFieldsSchema.safeParse({ ...base, lat: "-33.8688", lng: "151.2093" }).success).toBe(true);
  });

  it("defaults locale to en when omitted", () => {
    const r = reportFieldsSchema.safeParse({ ...base, locale: undefined });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.locale).toBe("en");
  });
});

describe("photo validation", () => {
  const jpeg = { size: 1000, type: "image/jpeg" };

  it("requires at least one photo", () => {
    expect(validatePhotos([])).toMatchObject({ ok: false });
  });

  it("accepts 1..3 photos", () => {
    expect(validatePhotos([jpeg, jpeg, jpeg])).toEqual({ ok: true });
  });

  it("rejects more than three photos", () => {
    expect(validatePhotos([jpeg, jpeg, jpeg, jpeg])).toMatchObject({ ok: false });
  });

  it("rejects oversized photos", () => {
    expect(validatePhotos([{ size: MAX_PHOTO_BYTES + 1, type: "image/jpeg" }])).toMatchObject({ ok: false });
  });

  it("rejects non-image types", () => {
    expect(validatePhotos([{ size: 1000, type: "application/pdf" }])).toMatchObject({ ok: false });
  });
});
