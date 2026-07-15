import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyBearerHeader, verifySvixSignature } from "@/lib/webhooks/resend";

describe("Resend webhook authentication", () => {
  it("verifies the raw body and any valid v1 signature in the Svix list", () => {
    const key = randomBytes(32);
    const secret = `whsec_${key.toString("base64")}`;
    const body = '{"type":"email.delivered"}';
    const id = "msg_test_123";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,invalid v1,${signature}`,
    });

    expect(verifySvixSignature(headers, body, secret, 1_700_000_000_000)).toBe(true);
    expect(verifySvixSignature(headers, `${body} `, secret, 1_700_000_000_000)).toBe(false);
  });

  it("rejects stale signed requests", () => {
    const key = randomBytes(32);
    const body = "{}";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", key)
      .update(`msg_old.${timestamp}.${body}`)
      .digest("base64");
    const headers = new Headers({
      "svix-id": "msg_old",
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    });
    expect(
      verifySvixSignature(headers, body, `whsec_${key.toString("base64")}`, 1_700_001_000_000),
    ).toBe(false);
  });

  it("accepts only an exact Bearer token", () => {
    expect(verifyBearerHeader("Bearer long-random-secret", "long-random-secret")).toBe(true);
    expect(verifyBearerHeader("Bearer wrong", "long-random-secret")).toBe(false);
    expect(verifyBearerHeader("long-random-secret", "long-random-secret")).toBe(false);
  });
});
