import { NextResponse, type NextRequest } from "next/server";

/**
 * Central admin gate (defense-in-depth). Every /api/admin/* route already calls
 * verifySession(), but this middleware enforces it in ONE place so a future route
 * that forgets the check is still protected. /api/admin/login is the only exception
 * (it issues the session). The /admin page stays reachable so its client-side login
 * form can render; it holds no data of its own.
 *
 * Edge-runtime safe: re-implements the HMAC verification with Web Crypto (the
 * node:crypto-based lib/admin/session.ts cannot run in middleware). The cookie
 * format and signing scheme are identical, so a cookie minted server-side verifies
 * here byte-for-byte.
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
  const [issued, mac] = value.split(".");
  if (!issued || !mac) return false;
  const expected = await hmacHex(key, issued);
  if (!constantTimeEqual(mac, expected)) return false;
  const ageMs = Date.now() - Number(issued);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MAX_AGE_MS;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // The login route must stay open — it is what issues the session.
  if (pathname === "/api/admin/login") return NextResponse.next();

  if (await hasValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
