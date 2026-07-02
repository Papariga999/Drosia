"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/track";
import { useLocale } from "@/components/LocaleProvider";

/**
 * First-party, cookieless page-view beacon for the public app only (mounted in
 * the public layout, never on /admin). Fires once per route change. See
 * lib/track.ts for the privacy posture (no cookie/fingerprint/IP).
 *
 * We read the locale from the LocaleProvider context (not <html lang>) so the
 * page's UI language is recorded correctly from the first paint. It's kept in a
 * ref so a locale change alone never fires an extra pageview — one per route.
 */
export function TrackPageView() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const localeRef = useRef(locale);

  // Keep the latest locale in a ref so the pageview effect (which fires only on
  // route change) reads the current value without re-firing on locale changes.
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    trackEvent("pageview", { locale: localeRef.current });
  }, [pathname]);

  return null;
}
