import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The Web-Push sender must be fail-safe: with no VAPID keys configured it
 * no-ops (returns, never throws), so the app runs fine before activation and a
 * push problem can never break the status transition that triggered it.
 */
describe("notifyReportFollowers without VAPID configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns without throwing when VAPID keys are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    // Unset Supabase too — the unconfigured guard must bail before any DB access.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { notifyReportFollowers } = await import("@/lib/push/send");
    await expect(
      notifyReportFollowers("00000000-0000-0000-0000-000000000000", {
        title: "t",
        body: "b",
        url: "https://example.org/r/x",
      }),
    ).resolves.toBeUndefined();
  });
});
