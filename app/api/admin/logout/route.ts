import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifyAdminMutation,
} from "@/lib/admin/session";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
