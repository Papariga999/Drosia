import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt — allow the public app, keep the operator tool and API out of
 * search indexes. Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/me/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
