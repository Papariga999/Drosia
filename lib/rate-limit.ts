import "server-only";
import { createHmac } from "node:crypto";

/**
 * In-memory fixed-window IP rate limiter.
 *
 * NOTE: per-instance only — state is not shared across serverless instances or
 * regions. Good enough as a first-pass abuse brake on the submit route; replace
 * with a durable store (Upstash/Postgres) before relying on it as a hard limit.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Client IP from TRUSTED proxy headers only.
 *
 * Order matters for security: we read headers the hosting proxy injects and a
 * client cannot override (Vercel rewrites x-vercel-forwarded-for / x-real-ip at
 * the edge). We deliberately do NOT trust cf-connecting-ip or the leftmost
 * x-forwarded-for by default — a client can send those, which would let an
 * attacker rotate the rate-limit key and bypass the limit. cf-connecting-ip is
 * only honored when TRUST_CF_HEADER=true (i.e. the app really sits behind CF).
 */
export function clientIp(headers: Headers): string {
  if (process.env.TRUST_CF_HEADER === "true") {
    const cf = headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
  }
  // Vercel overwrites these at its edge. Do not trust the same names merely
  // because a client sent them to a self-hosted Node process.
  if (process.env.VERCEL === "1") {
    const vercel = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
    if (vercel) return vercel.split(",")[0]!.trim().slice(0, 64);
    const real = headers.get("x-real-ip");
    if (real) return real.trim().slice(0, 64);
  }
  // Generic reverse proxies must be opted into explicitly and configured to
  // overwrite, not append to, inbound forwarding headers.
  if (process.env.TRUST_PROXY_HEADER === "true") {
    const fwd = headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
    if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  }
  return "unknown";
}

/** Pseudonymize rate-limit identifiers before any durable database write. */
export function pseudonymousRateLimitKey(key: string): string {
  const secret =
    process.env.RATE_LIMIT_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.WEBHOOK_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "drosia-development-rate-limit-key";
  return `v1:${createHmac("sha256", secret).update(key).digest("hex")}`;
}

export interface DurableRateLimitOptions {
  /** A missing/broken DB limiter must not become a production auth bypass. */
  failClosedInProduction?: boolean;
}

/**
 * Deny cache in front of the durable limiter: once the database has confirmed
 * a key is over its limit, repeat checks for that key are answered from
 * instance memory until the window resets. A sustained flood from one source
 * then costs the database roughly one write per window per instance instead of
 * one per request. The durable limiter stays the source of truth — this only
 * short-circuits repeats of a decision it already made. Fail-closed denials
 * are deliberately NOT cached: they are not confirmed over-limits, and caching
 * them would keep locking out legitimate users after a transient DB blip.
 */
const denyUntil = new Map<string, number>();
const DENY_CACHE_MAX_KEYS = 10_000;

function cachedDenial(key: string): RateLimitResult | null {
  const until = denyUntil.get(key);
  if (until === undefined) return null;
  const now = Date.now();
  if (now >= until) {
    denyUntil.delete(key);
    return null;
  }
  return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((until - now) / 1000)) };
}

function rememberDenial(key: string, retryAfterSeconds: number): void {
  if (denyUntil.size >= DENY_CACHE_MAX_KEYS) {
    const now = Date.now();
    for (const [staleKey, until] of denyUntil) {
      if (until <= now) denyUntil.delete(staleKey);
    }
    // Still full after dropping expired entries: forget rather than grow —
    // the durable limiter remains authoritative, memory stays bounded.
    if (denyUntil.size >= DENY_CACHE_MAX_KEYS) denyUntil.clear();
  }
  denyUntil.set(key, Date.now() + Math.max(1, retryAfterSeconds) * 1000);
}

/**
 * Durable, cross-instance rate limit backed by Postgres (rate_limit_hit RPC).
 * The in-memory limiter above is per-serverless-instance and resets on every
 * cold start, so it cannot protect the admin login from brute force. This shares
 * a single counter across all instances. Degrades to the in-memory limiter if the
 * DB/RPC is unavailable (e.g. not yet migrated) — a weak limit beats none.
 */
export async function rateLimitDurable(
  key: string,
  limit: number,
  windowMs: number,
  options: DurableRateLimitOptions = {},
): Promise<RateLimitResult> {
  const denied = cachedDenial(key);
  if (denied) return denied;

  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const { data, error } = await getSupabaseAdmin().rpc("rate_limit_hit", {
      p_key: pseudonymousRateLimitKey(key),
      p_limit: limit,
      p_window_ms: windowMs,
    } as never);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; retry_after_seconds?: number }
      | null;
    if (!row || typeof row.allowed !== "boolean") throw new Error("rate_limit_hit: no row");
    if (!row.allowed) {
      const retryAfterSeconds = Math.max(1, Number(row.retry_after_seconds ?? 1));
      rememberDenial(key, retryAfterSeconds);
      return { ok: false, remaining: 0, retryAfterSeconds };
    }
    return { ok: true, remaining: 0, retryAfterSeconds: 0 };
  } catch {
    if (options.failClosedInProduction && process.env.NODE_ENV === "production") {
      return { ok: false, remaining: 0, retryAfterSeconds: 60 };
    }
    return rateLimit(key, limit, windowMs);
  }
}
