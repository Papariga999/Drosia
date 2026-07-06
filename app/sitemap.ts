import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * XML sitemap for the public, indexable routes. Per-report and per-authority
 * pages are intentionally excluded (token URLs are private/ephemeral; authority
 * pages are generated on demand). Operator (/admin), API and per-device (/me)
 * routes are excluded here and disallowed in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entry = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    entry("", "daily", 1),
    entry("/report", "monthly", 0.9),
    entry("/map", "daily", 0.8),
    entry("/urgent", "daily", 0.7),
    entry("/support", "monthly", 0.6),
    entry("/privacy", "yearly", 0.3),
    entry("/imprint", "yearly", 0.3),
    entry("/terms", "yearly", 0.3),
  ];
}
