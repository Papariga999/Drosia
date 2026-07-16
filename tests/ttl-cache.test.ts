import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/ttl-cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves the cached value within the TTL (loader runs once)", async () => {
    const cache = new TtlCache<string>(30_000);
    const load = vi.fn(async () => "fresh");

    expect(await cache.get("k", load)).toBe("fresh");
    vi.advanceTimersByTime(29_000);
    expect(await cache.get("k", load)).toBe("fresh");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the TTL expires", async () => {
    const cache = new TtlCache<number>(30_000);
    let counter = 0;
    const load = vi.fn(async () => ++counter);

    expect(await cache.get("k", load)).toBe(1);
    vi.advanceTimersByTime(30_001);
    expect(await cache.get("k", load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent misses into a single load", async () => {
    const cache = new TtlCache<string>(30_000);
    let resolveLoad!: (value: string) => void;
    const load = vi.fn(
      () => new Promise<string>((resolve) => (resolveLoad = resolve)),
    );

    const first = cache.get("k", load);
    const second = cache.get("k", load);
    resolveLoad("once");

    expect(await first).toBe("once");
    expect(await second).toBe("once");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache failed loads — the next caller retries", async () => {
    const cache = new TtlCache<string>(30_000);
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.get("k", load)).rejects.toThrow("db down");
    expect(await cache.get("k", load)).toBe("recovered");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keys are independent", async () => {
    const cache = new TtlCache<string>(30_000);
    expect(await cache.get("a", async () => "A")).toBe("A");
    expect(await cache.get("b", async () => "B")).toBe("B");
    expect(await cache.get("a", async () => "changed")).toBe("A");
  });

  it("bounds stored entries by evicting the stalest key", async () => {
    const cache = new TtlCache<number>(30_000, 2);
    await cache.get("first", async () => 1);
    vi.advanceTimersByTime(1_000);
    await cache.get("second", async () => 2);
    vi.advanceTimersByTime(1_000);
    await cache.get("third", async () => 3); // evicts "first"

    const reload = vi.fn(async () => 99);
    expect(await cache.get("first", reload)).toBe(99); // was evicted → reloads
    expect(await cache.get("third", async () => -1)).toBe(3); // still cached
  });

  it("clear() empties the cache", async () => {
    const cache = new TtlCache<string>(30_000);
    await cache.get("k", async () => "v1");
    cache.clear();
    expect(await cache.get("k", async () => "v2")).toBe("v2");
  });
});
