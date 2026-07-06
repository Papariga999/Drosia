import { NextResponse, type NextRequest } from "next/server";

/**
 * Two jobs, one middleware:
 *
 * 1. ADMIN GATE (defense-in-depth). Every /api/admin/* route already calls
 *    verifySession(), but this enforces it in ONE place so a future route that
 *    forgets the check is still protected. /api/admin/login is the only
 *    exception (it issues the session). The /admin page stays reachable so its
 *    client-side login form can render; it holds no data of its own.
 *
 * 2. NONCE-BASED CSP for every document (page) response. A fresh nonce is
 *    minted per request; Next.js reads it from the request's
 *    Content-Security-Policy header and stamps it onto its own inline
 *    bootstrap scripts, so production drops script-src 'unsafe-inline'.
 *    Requires every page to render dynamically (static HTML can't carry a
 *    per-request nonce) — all pages export `dynamic = "force-dynamic"`.
 *    style-src keeps 'unsafe-inline': nonces don't apply to style ATTRIBUTES,
 *    and React style props + Leaflet write those everywhere. Dev keeps the
 *    permissive policy (HMR needs eval/inline).
 *
 * Edge-runtime safe: re-implements the HMAC verification with Web Crypto (the
 * node:crypto-based lib/admin/session.ts cannot run in middleware). The cookie
 * format and signing scheme are identical, so a cookie minted server-side
 * verifies here byte-for-byte.
 */
const ADMIN_COOKIE = "drosia_admin";
const MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // mirrors session.ts

function secret(): string | null {
  const configured = process.env.ADMIN_SESSION_SECRET || process.env.WEBHOOK_SECRET;
  if (configured) return configured;
  // Never accept a default secret in production (forgeable cookies → takeover).
  return process.env.NODE_ENV === "production" ? null : "dev-insecure-secret";
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function passwordFingerprint(): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(process.env.ADMIN_PASSWORD ?? ""),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hasValidSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const key = secret();
  if (!key) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issued, fp, mac] = parts;
  if (!issued || !fp || !mac) return false;
  const expected = await hmacHex(key, `${issued}.${fp}`);
  if (!constantTimeEqual(mac, expected)) return false;
  if (!constantTimeEqual(fp, await passwordFingerprint())) return false; // password rotated → revoked
  const ageMs = Date.now() - Number(issued);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_MS;
}

function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function buildCsp(nonce: string | null): string {
  // With 'strict-dynamic', nonce'd scripts may load further scripts (Next's
  // chunk loading, @vercel/analytics); 'self' stays as the CSP2 fallback.
  const script = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'"; // dev / HMR
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    // style ATTRIBUTES can't take nonces, so 'unsafe-inline' stays. Fonts are
    // self-hosted via next/font — no Google Fonts hosts needed anymore.
    "style-src 'self' 'unsafe-inline'",
    script,
    "connect-src 'self' https:",
    "font-src 'self' data:",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // ── 1. Admin API gate ──────────────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    // The login route must stay open — it is what issues the session.
    if (pathname === "/api/admin/login") return NextResponse.next();
    if (await hasValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Per-request CSP nonce for documents ─────────────────────────────────
  const nonce = process.env.NODE_ENV === "production" ? makeNonce() : null;
  const csp = buildCsp(nonce);

  // Next.js picks the nonce up from the REQUEST header and applies it to its
  // inline bootstrap scripts; the RESPONSE header is what the browser enforces.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("content-security-policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: [
    // Admin API gate.
    "/api/admin/:path*",
    // Documents for the CSP nonce: everything except other API routes, Next
    // internals, and static files (anything with an extension).
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
