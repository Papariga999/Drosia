import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Launch-baseline admin auth: a single shared password + an HMAC-signed cookie
 * session (no public sign-up, no Supabase auth). Service-role work happens only
 * after verifySession() passes. Multi-user roles are a post-launch evolution.
 */
export const ADMIN_COOKIE = "drosia_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.WEBHOOK_SECRET || "dev-insecure-secret";
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

export function makeSessionValue(): string {
  const issued = Date.now().toString();
  return `${issued}.${sign(issued)}`;
}

export function isValidSessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const [issued, mac] = value.split(".");
  if (!issued || !mac) return false;
  if (!safeEqual(mac, sign(issued))) return false;
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
