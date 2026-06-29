/**
 * Client-side, cookieless analytics beacon. Shared by the page-view tracker and
 * the behavioral funnel events. Privacy: no cookies, no fingerprint, no PII —
 * just a random, tab-scoped session id (cleared when the tab closes). The server
 * (/api/track) validates the event, derives a coarse country at the edge, and
 * never stores the IP. Fire-and-forget: it must never throw or block the UI.
 */
function getSid(): string {
  let sid = sessionStorage.getItem("drosia_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("drosia_sid", sid);
  }
  return sid;
}

export function trackEvent(event: string, opts?: { reportToken?: string }): void {
  if (typeof window === "undefined") return;
  try {
    const path = opts?.reportToken ? `/r/${opts.reportToken}` : window.location.pathname + window.location.search;
    const body = JSON.stringify({
      event,
      path,
      ref: document.referrer || "",
      sid: getSid(),
      locale: document.documentElement.lang || "",
    });
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}
