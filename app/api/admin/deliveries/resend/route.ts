import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { deliverAndLog } from "@/lib/admin/deliver-report";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /api/admin/deliveries/resend { reportId } — re-deliver + log (shared path). */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reportId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.reportId ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid reportId." }, { status: 400 });

  const result = await deliverAndLog(id);
  if (result.delivery === "not_found") return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (result.delivery === "awaiting_channel") {
    return NextResponse.json({ delivery: "awaiting_channel", error: "No authority email/channel." }, { status: 409 });
  }
  return NextResponse.json({ delivery: result.delivery, status: result.status, error: result.error });
}
