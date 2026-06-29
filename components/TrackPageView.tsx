"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * First-party, cookieless page-view beacon for the public app only (mounted in
 * the public layout, never on /admin). Fires once per route change.
 *
 * Privacy: NO cookies, NO fingerprinting, NO IP. `sid` is a random id kept in
 * sessionStorage (cleared when the tab closes) purely to approximate "sessions"
 * — it is not an identity and never leaves the analytics aggregates. The server
 * (/api/track) derives a coarse country from the edge header and discards the IP.
 */
export function TrackPageView() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      let sid = sessionStorage.getItem("drosia_sid");
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem("drosia_sid", sid);
      }
      const body = JSON.stringify({
        // path+query so the server can read utm_* for source attribution
        path: window.location.pathname + window.location.search,
        ref: document.referrer || "",
        sid,
        locale: document.documentElement.lang || "",
      });
      // keepalive lets the request finish even as the user navigates away.
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);

  return null;
}
