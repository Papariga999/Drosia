import { NextResponse, type NextRequest } from "next/server";
import { isMutationMethod, isSameOriginRequest } from "@/lib/admin/request-origin";

/**
 * Next.js 16 routing proxy:
 * 1. defense-in-depth admin API auth + CSRF gate;
 * 2. per-document nonce-based Content Security Policy.
 */
const ADMIN_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-drosia_admin" : "drosia_admin";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isPlaceholder(value: string): boolean {
  return /^(change_me|changeme|password|secret|your_)/i.test(value.trim());
}

function secret(): string | null {
  const configured = process.env.ADMIN_SESSION_SECRET ?? "";
  if (configured && (process.env.NODE_ENV !== "production" || (configured.length >= 32 && !isPlaceholder(configured)))) {
    return configured;
  }
  return process.env.NODE_ENV === "production"
    ? null
    : configured || "dev-insecure-admin-session-secret";
}

function adminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) return null;
  if (process.env.NODE_ENV === "production" && (password.length < 16 || isPlaceholder(password))) {
    return null;
  }
  return password;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function passwordFingerprint(password: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function hasValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const key = secret();
  const password = adminPassword();
  if (!key || !password) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issued, fingerprint, mac] = parts;
  if (!issued || !fingerprint || !mac) return false;
  const expectedMac = await hmacHex(key, `${issued}.${fingerprint}`);
  if (!constantTimeEqual(mac, expectedMac)) return false;
  if (!constantTimeEqual(fingerprint, await passwordFingerprint(password))) return false;
  const ageMs = Date.now() - Number(issued);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_MS;
}

function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildCsp(nonce: string | null): string {
  const script = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    script,
    "connect-src 'self' https:",
    "font-src 'self' data:",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

function adminPassThrough(): NextResponse {
  const response = NextResponse.next();
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/admin")) {
    if (isMutationMethod(req.method) && !isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pathname === "/api/admin/login") return adminPassThrough();
    if (await hasValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) return adminPassThrough();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nonce = process.env.NODE_ENV === "production" ? makeNonce() : null;
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("content-security-policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
