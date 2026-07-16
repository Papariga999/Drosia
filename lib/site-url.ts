/**
 * Canonical, absolute site origin used for metadata, robots and the sitemap.
 * Prefers NEXT_PUBLIC_APP_URL (set per environment); falls back to the live
 * Vercel URL so generated URLs are never localhost in production.
 * (drosia.eu is planned but NOT purchased yet — it must not appear anywhere
 * until it is; when bought, set NEXT_PUBLIC_APP_URL instead of editing this.)
 * Trailing slash is stripped so callers can safely append paths.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://drosia.vercel.app"
);

/** Bare host for display contexts (footer, share cards, OG images). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
