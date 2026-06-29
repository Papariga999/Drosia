import { describe, it, expect } from "vitest";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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

  it("does NOT trust cf-connecting-ip by default (client-spoofable)", () => {
    const headers = h({ "cf-connecting-ip": "1.2.3.4", "x-real-ip": "9.9.9.9" });
    expect(clientIp(headers)).toBe("9.9.9.9");
  });

  it("prefers the Vercel-injected header over x-forwarded-for", () => {
    const headers = h({ "x-vercel-forwarded-for": "5.5.5.5", "x-forwarded-for": "6.6.6.6, 7.7.7.7" });
    expect(clientIp(headers)).toBe("5.5.5.5");
  });

  it("falls back to the leftmost x-forwarded-for only as a last resort", () => {
    expect(clientIp(h({ "x-forwarded-for": "8.8.8.8, 1.1.1.1" }))).toBe("8.8.8.8");
  });

  it("returns 'unknown' when no trusted header is present", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});
