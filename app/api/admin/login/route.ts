import { NextResponse } from "next/server";
import { checkPassword, makeSessionValue, ADMIN_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/admin/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req.headers);
  const limit = rateLimit(`admin-login:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!checkPassword(body.password ?? "")) {
    // No user enumeration — generic message.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(), SESSION_COOKIE_OPTIONS);
  return res;
}
