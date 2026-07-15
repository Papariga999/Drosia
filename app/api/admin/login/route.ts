import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  checkPassword,
  makeSessionValue,
  ADMIN_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/admin/session";
import { rateLimitDurable, clientIp } from "@/lib/rate-limit";
import { readJsonBody, RequestBodyError } from "@/lib/http-body";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/admin/request-origin";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(1).max(1024) }).strict();

export async function POST(req: Request): Promise<Response> {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Admin authentication is not configured securely." }, { status: 503 });
  }
  const ip = clientIp(req.headers);
  const limit = await rateLimitDurable(`admin-login:${ip}`, 10, 10 * 60 * 1000, {
    failClosedInProduction: true,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { password?: string };
  try {
    body = await readJsonBody(req, 4 * 1024);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Bad request." }, { status });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  if (!checkPassword(parsed.data.password)) {
    const globalFailures = await rateLimitDurable("admin-login:global-failures", 100, 10 * 60 * 1000, {
      failClosedInProduction: true,
    });
    if (!globalFailures.ok) {
      return NextResponse.json(
        { error: "Too many attempts." },
        { status: 429, headers: { "Retry-After": String(globalFailures.retryAfterSeconds) } },
      );
    }
    // No user enumeration — generic message.
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(), SESSION_COOKIE_OPTIONS);
  res.headers.set("cache-control", "private, no-store");
  return res;
}
