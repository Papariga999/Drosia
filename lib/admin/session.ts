import "server-only";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSameOriginRequest } from "@/lib/admin/request-origin";

/** Single-operator launch authentication; no public accounts or sign-up. */
export const ADMIN_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-drosia_admin" : "drosia_admin";
const MAX_AGE_SECONDS = 12 * 60 * 60;

function isPlaceholder(value: string): boolean {
  return /^(change_me|changeme|password|secret|your_)/i.test(value.trim());
}

function configuredPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) return null;
  if (process.env.NODE_ENV === "production" && (password.length < 16 || isPlaceholder(password))) {
    return null;
  }
  return password;
}

function sessionSecret(): string {
  const configured = process.env.ADMIN_SESSION_SECRET ?? "";
  if (configured && (process.env.NODE_ENV !== "production" || (configured.length >= 32 && !isPlaceholder(configured)))) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET must be an independent random value of at least 32 characters.");
  }
  return configured || "dev-insecure-admin-session-secret";
}

export function adminAuthConfigured(): boolean {
  if (!configuredPassword()) return false;
  try {
    return sessionSecret().length > 0;
  } catch {
    return false;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkPassword(input: string): boolean {
  const expected = configuredPassword();
  if (!expected) return false;
  // Compare fixed-size digests so input length does not create a timing branch.
  const actualDigest = createHash("sha256").update(input).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function passwordFingerprint(): string {
  const password = configuredPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not securely configured.");
  return createHash("sha256").update(password).digest("hex").slice(0, 16);
}

export function makeSessionValue(): string {
  const payload = `${Date.now()}.${passwordFingerprint()}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionValue(value: string | undefined): boolean {
  try {
    if (!value || !adminAuthConfigured()) return false;
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    const [issued, fingerprint, mac] = parts;
    if (!issued || !fingerprint || !mac) return false;
    if (!safeEqual(mac, sign(`${issued}.${fingerprint}`))) return false;
    if (!safeEqual(fingerprint, passwordFingerprint())) return false;
    const ageMs = Date.now() - Number(issued);
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_SECONDS * 1000;
  } catch {
    return false;
  }
}

export async function verifySession(): Promise<boolean> {
  const store = await cookies();
  return isValidSessionValue(store.get(ADMIN_COOKIE)?.value);
}

/** Handler-level auth + CSRF guard for every privileged mutation. */
export async function verifyAdminMutation(req: Request): Promise<boolean> {
  return isSameOriginRequest(req) && verifySession();
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
