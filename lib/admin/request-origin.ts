/** Methods that can change privileged state and therefore require CSRF checks. */
export function isMutationMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/**
 * Reject browser requests from cross-site and same-site sibling origins. CLI
 * clients without browser fetch metadata remain usable, but still need the
 * signed HttpOnly admin cookie.
 */
export function isSameOriginRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}
