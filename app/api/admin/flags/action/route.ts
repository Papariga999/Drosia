import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { purgePublicPhotos } from "@/lib/admin/takedown";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/flags/action { id, action }
 *   remove  → flag actioned + report rejected (unpublished — DSA takedown)
 *   dismiss → flag dismissed (content stays)
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  if (body.action !== "remove" && body.action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: flag } = await admin
    .from("content_flags")
    .select("id, report_id")
    .eq("id", id)
    .maybeSingle<{ id: string; report_id: string }>();
  if (!flag) return NextResponse.json({ error: "Flag not found." }, { status: 404 });

  if (body.action === "remove") {
    await admin.from("reports").update({ status: "rejected" } as never).eq("id", flag.report_id);
    await admin.from("content_flags").update({ status: "actioned" } as never).eq("id", id);
    await purgePublicPhotos(flag.report_id); // DSA takedown: drop the public photo object
    return NextResponse.json({ ok: true, action: "removed" });
  }

  await admin.from("content_flags").update({ status: "dismissed" } as never).eq("id", id);
  return NextResponse.json({ ok: true, action: "dismissed" });
}
