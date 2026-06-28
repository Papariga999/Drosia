import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { purgePublicPhotos } from "@/lib/admin/takedown";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS = ["private_person", "spam_invalid", "out_of_scope"];

/** POST /api/admin/reports/reject  { id, reason } → status rejected (terminal). */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (body.reason && !REASONS.includes(body.reason)) {
    return NextResponse.json({ error: "Invalid reason." }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("reports")
    .update({ status: "rejected" } as never)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remove any already-published anonymized photo from the public bucket.
  await purgePublicPhotos(id);
  return NextResponse.json({ status: "rejected" });
}
