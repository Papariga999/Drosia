/**
 * Anonymous, client-generated device token (NOT PII, NO account).
 * Persisted in localStorage so the same browser can later see "my reports".
 * Per-browser and loss-prone by design — never repaired via email/login.
 */
const KEY = "drosia_device_token";

export function getDeviceToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = localStorage.getItem(KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(KEY, token);
    }
    return token;
  } catch {
    return "";
  }
}
