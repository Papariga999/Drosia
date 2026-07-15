import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const SVIX_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyBearerHeader(authorization: string | null, expected: string): boolean {
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return !!match?.[1] && safeEqual(match[1], expected);
}

/** Manual Svix verification over the untouched request bytes. */
export function verifySvixSignature(
  headers: Headers,
  rawBody: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  try {
    const id = headers.get("svix-id");
    const timestamp = headers.get("svix-timestamp");
    const signatureHeader = headers.get("svix-signature");
    if (!id || !timestamp || !signatureHeader) return false;

    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds)) return false;
    if (Math.abs(nowMs / 1000 - timestampSeconds) > SVIX_TOLERANCE_SECONDS) return false;

    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    if (key.byteLength < 16) return false;
    const expected = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${rawBody}`)
      .digest("base64");

    return signatureHeader.split(" ").some((part) => {
      const [version, signature] = part.split(",", 2);
      return version === "v1" && !!signature && safeEqual(signature, expected);
    });
  } catch {
    return false;
  }
}
