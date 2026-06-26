import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

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
};

export default nextConfig;
