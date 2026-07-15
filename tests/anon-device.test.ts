import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The device gate is the anti-vote-inflation control: known devices always
 * pass, unknown devices must fit the per-IP registration budget. Supabase and
 * the durable rate limiter are mocked — the decision logic is what's under test.
 */
const rateLimitDurable = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimitDurable: (...args: unknown[]) => rateLimitDurable(...args),
}));

let knownTokens: Set<string>;
let upsertError: { message: string } | null;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, token: string) => ({
          maybeSingle: async () => ({ data: knownTokens.has(token) ? { id: "dev-1" } : null }),
        }),
      }),
      update: () => ({
        eq: () => ({ then: (onOk?: () => void) => Promise.resolve().then(onOk, () => {}) }),
      }),
      upsert: async () => ({ error: upsertError }),
    }),
  }),
}));

import { ensureKnownDevice, NEW_DEVICE_LIMIT, NEW_DEVICE_WINDOW_MS } from "@/lib/anon-device";

beforeEach(() => {
  knownTokens = new Set();
  upsertError = null;
  rateLimitDurable.mockReset();
});

describe("ensureKnownDevice (anti-vote-inflation gate)", () => {
  it("passes a known device without touching the registration budget", async () => {
    knownTokens.add("known-token");
    const result = await ensureKnownDevice("known-token", "1.2.3.4");
    expect(result.ok).toBe(true);
    expect(rateLimitDurable).not.toHaveBeenCalled();
  });

  it("registers an unknown device against the per-IP identity budget", async () => {
    rateLimitDurable.mockResolvedValue({ ok: true, remaining: 0, retryAfterSeconds: 0 });
    const result = await ensureKnownDevice("fresh-token", "1.2.3.4");
    expect(result.ok).toBe(true);
    expect(rateLimitDurable).toHaveBeenCalledWith(
      "device-reg:1.2.3.4",
      NEW_DEVICE_LIMIT,
      NEW_DEVICE_WINDOW_MS,
      { failClosedInProduction: true },
    );
  });

  it("blocks an unknown device when the IP's identity budget is exhausted", async () => {
    rateLimitDurable.mockResolvedValue({ ok: false, remaining: 0, retryAfterSeconds: 3600 });
    const result = await ensureKnownDevice("mint-per-vote", "6.6.6.6");
    expect(result).toEqual({ ok: false, retryAfterSeconds: 3600 });
  });

  it("fails closed when registration cannot be persisted", async () => {
    rateLimitDurable.mockResolvedValue({ ok: true, remaining: 0, retryAfterSeconds: 0 });
    upsertError = { message: "db down" };
    const result = await ensureKnownDevice("fresh-token", "1.2.3.4");
    expect(result.ok).toBe(false);
  });
});
