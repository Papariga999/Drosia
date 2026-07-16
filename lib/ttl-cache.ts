import "server-only";

/**
 * Tiny per-instance TTL cache with request coalescing for public read paths.
 *
 * Purpose: DDoS/cost containment, not correctness. Public pages are
 * force-dynamic (per-request CSP nonce, per-request <html lang>), so page-level
 * ISR is not available — without a data cache every page view and every
 * /api/reports/nearby call fans out into live Supabase queries. Bounding reads
 * to one refresh per TTL per warm instance turns an L7 request flood from
 * "N requests → N×4 DB queries" into "a handful of DB queries per instance per
 * TTL window", and cuts normal-traffic DB load the same way.
 *
 * Deliberately per-instance (module state, no external store): serverless
 * instances refresh independently, which is still a drastic reduction under
 * load, adds no new dependency, and keeps behavior identical in dev/test.
 * Concurrent misses share one in-flight promise, so a burst on a cold instance
 * triggers a single load. Failed loads are never cached — the next caller
 * retries. Callers receive the SAME array/object instance and must not mutate
 * cached values.
 */
type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 16,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await load();
        this.evictIfFull(key);
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return promise;
  }

  /** Keys are a small fixed set in practice; this guards key-space mistakes. */
  private evictIfFull(incomingKey: string): void {
    if (this.entries.size < this.maxEntries || this.entries.has(incomingKey)) return;
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) this.entries.delete(oldestKey);
  }

  /** Test hook / explicit invalidation. */
  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }
}
