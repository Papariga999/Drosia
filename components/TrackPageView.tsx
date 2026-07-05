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
  const activeMsRef = useRef(0);
  const lastSentMsRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);

  // Keep the latest locale in a ref so the pageview effect (which fires only on
  // route change) reads the current value without re-firing on locale changes.
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    trackEvent("pageview", { locale: localeRef.current });
  }, [pathname]);

  useEffect(() => {
    const sendEveryMs = 30_000;
    const minDeltaMs = 5_000;

    function accumulateVisibleTime() {
      if (visibleSinceRef.current == null) return;
      const now = performance.now();
      activeMsRef.current += Math.max(0, now - visibleSinceRef.current);
      visibleSinceRef.current = now;
    }

    function sendDuration(force = false) {
      accumulateVisibleTime();
      const durationMs = Math.round(activeMsRef.current);
      if (durationMs < 1_000) return;
      if (!force && durationMs - lastSentMsRef.current < minDeltaMs) return;
      lastSentMsRef.current = durationMs;
      trackEvent("session_duration", { locale: localeRef.current, durationMs });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendDuration(true);
        visibleSinceRef.current = null;
        return;
      }
      if (visibleSinceRef.current == null) visibleSinceRef.current = performance.now();
    }

    function handlePageHide() {
      sendDuration(true);
    }

    handleVisibilityChange();
    const timer = window.setInterval(() => sendDuration(), sendEveryMs);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      sendDuration(true);
      window.clearInterval(timer);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
