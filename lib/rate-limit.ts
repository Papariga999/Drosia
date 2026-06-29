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
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  // Last resort: leftmost x-forwarded-for. Client-spoofable, so only a fallback.
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
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
): Promise<RateLimitResult> {
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
    const { data, error } = await getSupabaseAdmin().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    } as never);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; retry_after_seconds?: number }
      | null;
    if (!row || typeof row.allowed !== "boolean") throw new Error("rate_limit_hit: no row");
    return {
      ok: row.allowed,
      remaining: 0,
      retryAfterSeconds: row.allowed ? 0 : Math.max(1, Number(row.retry_after_seconds ?? 1)),
    };
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}
