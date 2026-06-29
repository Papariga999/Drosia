import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. Pragmatic baseline (no nonces yet): frame-ancestors
 * 'none' stops clickjacking (incl. the admin board), object-src 'none' blocks
 * plugin vectors. img/connect allow https: so Supabase Storage, OSM tiles and
 * Nominatim work without hardcoding the project ref. script/style keep
 * 'unsafe-inline' because Next.js injects inline bootstrap scripts/styles and
 * Leaflet uses inline styles — tighten to nonces in a later pass.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "connect-src 'self' https:",
  "font-src 'self' data:",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" }, // device/report tokens travel in URLs
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
