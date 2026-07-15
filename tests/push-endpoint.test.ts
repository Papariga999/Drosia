import { afterEach, describe, expect, it } from "vitest";
import { isSafePushEndpoint } from "@/lib/push/endpoint";

const previous = process.env.WEB_PUSH_ALLOWED_HOSTS;
afterEach(() => {
  if (previous === undefined) delete process.env.WEB_PUSH_ALLOWED_HOSTS;
  else process.env.WEB_PUSH_ALLOWED_HOSTS = previous;
});

describe("Web Push endpoint validation", () => {
  it("accepts known browser push services", () => {
    expect(isSafePushEndpoint("https://fcm.googleapis.com/fcm/send/opaque-token")).toBe(true);
    expect(isSafePushEndpoint("https://wns2-am3p.notify.windows.com/w/?token=opaque")).toBe(true);
  });

  it("rejects arbitrary, insecure, credentialed, and non-standard-port endpoints", () => {
    expect(isSafePushEndpoint("https://example.com/internal")).toBe(false);
    expect(isSafePushEndpoint("http://fcm.googleapis.com/fcm/send/token")).toBe(false);
    expect(isSafePushEndpoint("https://user:pass@fcm.googleapis.com/fcm/send/token")).toBe(false);
    expect(isSafePushEndpoint("https://fcm.googleapis.com:8443/fcm/send/token")).toBe(false);
  });

  it("allows an explicitly configured external push service", () => {
    process.env.WEB_PUSH_ALLOWED_HOSTS = "push.example.eu";
    expect(isSafePushEndpoint("https://push.example.eu/subscription/opaque")).toBe(true);
  });
});
