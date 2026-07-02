import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy lives in middleware.ts (per-request script nonce,
// production drops 'unsafe-inline'). Keeping a second copy here would make the
// browser enforce the intersection of two policies — one source only.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cross-origin requests (map tiles, fonts, etc.) receive only the site origin,
  // not report/device-token paths. OSM tiles reject requests with no Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
  // HSTS only in production (Vercel serves HTTPS); avoid pinning localhost.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: rootDir,
  },
  // Supabase Storage host for next/image will be added once the project ref is known:
  // images: { remotePatterns: [{ protocol: 'https', hostname: '<project>.supabase.co' }] },
  experimental: {
    // typedRoutes: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
