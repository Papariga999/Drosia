/** Known browser push-service hosts. Extra exact hosts can be configured. */
const DEFAULT_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

export function isSafePushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;

    const host = url.hostname.toLowerCase();
    const configured = (process.env.WEB_PUSH_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (DEFAULT_HOSTS.has(host) || configured.includes(host)) return true;
    return host.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}
