import { describe, it, expect, vi } from "vitest";

// session.ts imports next/headers for verifySession(); the pure token helpers
// under test never call cookies(), so a thin mock is enough.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

process.env.ADMIN_SESSION_SECRET = "test-secret-xyz";
process.env.ADMIN_PASSWORD = "hunter2";

import { makeSessionValue, isValidSessionValue } from "@/lib/admin/session";

describe("admin session (HMAC, password-bound)", () => {
  it("accepts a freshly minted session", () => {
    expect(isValidSessionValue(makeSessionValue())).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const v = makeSessionValue();
    const flipped = v.slice(0, -1) + (v.endsWith("a") ? "b" : "a");
    expect(isValidSessionValue(flipped)).toBe(false);
  });

  it("revokes existing sessions when the admin password changes", () => {
    const v = makeSessionValue();
    process.env.ADMIN_PASSWORD = "rotated-password";
    expect(isValidSessionValue(v)).toBe(false);
    process.env.ADMIN_PASSWORD = "hunter2"; // restore for other assertions
  });

  it("rejects malformed values", () => {
    expect(isValidSessionValue(undefined)).toBe(false);
    expect(isValidSessionValue("")).toBe(false);
    expect(isValidSessionValue("only.two")).toBe(false);
  });
});
