import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicReport } from "@/lib/reports";
import { clientIp, rateLimitDurable } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.string().trim().regex(/^[0-9a-f]{8,64}$/i);

/** Poll only for the anonymized public copy; original paths are never read. */
export async function GET(req: Request): Promise<Response> {
  const token = querySchema.safeParse(new URL(req.url).searchParams.get("token"));
  if (!token.success) {
    return NextResponse.json({ error: "Invalid report token." }, { status: 400 });
  }

  const limit = await rateLimitDurable(
    `pending-photo:${clientIp(req.headers)}`,
    120,
    10 * 60 * 1000,
    { failClosedInProduction: true },
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const report = await getPublicReport(token.data);
  if (!report || (report.status !== "submitted" && !report.pending)) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  return NextResponse.json(
    { photo_url: report.photo_url ?? null, processing: !report.photo_url },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
