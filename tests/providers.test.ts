import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { deliverReport } from "@/lib/providers/deliver";
import { reverseGeocode } from "@/lib/providers/geocoding";

describe("geocoding provider seam", () => {
  it("exposes reverseGeocode behind a swappable provider (stub until Phase 1 geocoder)", async () => {
    await expect(reverseGeocode(37.9838, 23.7275)).rejects.toThrow(/not implemented/i);
  });
});

describe("email delivery (dev mode, no RESEND_API_KEY)", () => {
  const prev = process.env.RESEND_API_KEY;
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    if (prev !== undefined) process.env.RESEND_API_KEY = prev;
  });

  it("fails clearly when there is no recipient", async () => {
    const r = await deliverReport({
      channel: "email",
      reportId: "00000000-0000-0000-0000-000000000000",
      reportToken: "demo",
      category: "litter",
      recipient: null,
      locale: "el",
    });
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/no recipient/i);
  });

  it("returns sent in dev mode (logs instead of hitting the network)", async () => {
    const r = await deliverReport({
      channel: "email",
      reportId: "00000000-0000-0000-0000-000000000000",
      reportToken: "demo",
      category: "litter",
      recipient: "perivallon@example.gr",
      locale: "el",
    });
    expect(r.status).toBe("sent");
    expect(r.providerMessageId).toContain("dev-");
  });
});
