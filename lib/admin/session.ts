import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Launch-baseline admin auth: a single shared password + an HMAC-signed cookie
 * session (no public sign-up, no Supabase auth). Service-role work happens only
 * after verifySession() passes. Multi-user roles are a post-launch evolution.
 */
export const ADMIN_COOKIE = "drosia_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const configured = process.env.ADMIN_SESSION_SECRET || process.env.WEBHOOK_SECRET;
  if (configured) return configured;
  // NEVER fall back to a hardcoded secret in production: a known secret means
  // anyone can forge a valid admin cookie (issued.HMAC(issued)) → full takeover.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_SESSION_SECRET (or WEBHOOK_SECRET) must be set in production — refusing an insecure default.",
    );
  }
  return "dev-insecure-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured → no access
  return safeEqual(input, expected);
}

/**
 * Short fingerprint of the current admin password. Binding it into the session
 * means changing ADMIN_PASSWORD invalidates every existing cookie (a basic
 * revocation: rotate the password to log everyone out). Mirrored byte-for-byte
 * in middleware.ts via Web Crypto.
 */
function passwordFingerprint(): string {
  return createHash("sha256").update(process.env.ADMIN_PASSWORD ?? "").digest("hex").slice(0, 16);
}

export function makeSessionValue(): string {
  const payload = `${Date.now()}.${passwordFingerprint()}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issued, fp, mac] = parts;
  if (!issued || !fp || !mac) return false;
  if (!safeEqual(mac, sign(`${issued}.${fp}`))) return false;
  if (!safeEqual(fp, passwordFingerprint())) return false; // password rotated → revoked
  const ageMs = Date.now() - Number(issued);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_SECONDS * 1000;
}

/** Read the admin cookie from the request and verify it. */
export async function verifySession(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionValue(store.get(ADMIN_COOKIE)?.value);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
