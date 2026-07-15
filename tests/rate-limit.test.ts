import { afterEach, describe, it, expect } from "vitest";
import { rateLimit, clientIp, pseudonymousRateLimitKey } from "@/lib/rate-limit";

const originalEnv = {
  VERCEL: process.env.VERCEL,
  TRUST_CF_HEADER: process.env.TRUST_CF_HEADER,
  TRUST_PROXY_HEADER: process.env.TRUST_PROXY_HEADER,
  RATE_LIMIT_SECRET: process.env.RATE_LIMIT_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `t:${Math.random()}`;
    expect(rateLimit(key, 1, 1).ok).toBe(true);
    // window of 1ms: a later call lands in a fresh window
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit(key, 1, 1).ok).toBe(true);
        resolve();
      }, 5);
    });
  });
});

describe("clientIp (anti-spoofing)", () => {
  function h(init: Record<string, string>): Headers {
    return new Headers(init);
  }

  it("does not trust proxy-looking headers without an explicit platform/proxy trust boundary", () => {
    const headers = h({ "cf-connecting-ip": "1.2.3.4", "x-real-ip": "9.9.9.9" });
    expect(clientIp(headers)).toBe("unknown");
  });

  it("uses the Vercel-overwritten header on Vercel", () => {
    process.env.VERCEL = "1";
    const headers = h({ "x-vercel-forwarded-for": "5.5.5.5", "x-forwarded-for": "6.6.6.6, 7.7.7.7" });
    expect(clientIp(headers)).toBe("5.5.5.5");
  });

  it("allows an explicitly trusted generic proxy to supply x-forwarded-for", () => {
    process.env.TRUST_PROXY_HEADER = "true";
    expect(clientIp(h({ "x-forwarded-for": "8.8.8.8, 1.1.1.1" }))).toBe("8.8.8.8");
  });

  it("allows Cloudflare's header only when that deployment mode is enabled", () => {
    process.env.TRUST_CF_HEADER = "true";
    expect(clientIp(h({ "cf-connecting-ip": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no trusted header is present", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("durable rate-limit key privacy", () => {
  it("stores a stable HMAC pseudonym rather than the raw IP-bearing key", () => {
    process.env.RATE_LIMIT_SECRET = "test-secret-that-is-not-public";
    const raw = "report:203.0.113.42";
    const first = pseudonymousRateLimitKey(raw);
    expect(first).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.42");
    expect(pseudonymousRateLimitKey(raw)).toBe(first);
    expect(pseudonymousRateLimitKey("report:203.0.113.43")).not.toBe(first);
  });
});
