"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track";

/**
 * First-party, cookieless page-view beacon for the public app only (mounted in
 * the public layout, never on /admin). Fires once per route change. See
 * lib/track.ts for the privacy posture (no cookie/fingerprint/IP).
 */
export function TrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    trackEvent("pageview");
  }, [pathname]);

  return null;
}
