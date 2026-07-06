/**
 * Canonical, absolute site origin used for metadata, robots and the sitemap.
 * Prefers NEXT_PUBLIC_APP_URL (set per environment); falls back to the
 * production domain so generated URLs are never localhost in production.
 * Trailing slash is stripped so callers can safely append paths.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://drosia.eu"
);
