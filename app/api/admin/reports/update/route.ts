import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isReportCategory } from "@/lib/categories";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/reports/update  { id, category?, description?, authority_id? }
 *
 * Operator edit of report content + routing — works on any status, including
 * already published (in_review/notified/resolved) reports, since the public
 * views read straight from `reports`. authority_id (re)routes the report to a
 * municipality (or null to unroute), which is how an out-of-bounds/unrouted test
 * report gets a recipient so approval can email it. Status changes go through
 * approve/reject/visibility. Same validation as intake (category enum,
 * description ≤ 500). updated_at is bumped by the trg_reports_updated_at trigger.
 */
export async function PATCH(req: Request): Promise<Response> {
  if (!(await verifySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; category?: string; description?: string | null; authority_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const id = body.id ?? "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const patch: { category?: string; description?: string | null; authority_id?: string | null } = {};

  if (body.category !== undefined) {
    if (!isReportCategory(body.category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    patch.category = body.category;
  }

  if (body.description !== undefined) {
    const desc = body.description === null ? "" : String(body.description).trim();
    if (desc.length > 500) {
      return NextResponse.json({ error: "Description exceeds 500 characters." }, { status: 400 });
    }
    patch.description = desc.length ? desc : null;
  }

  if (body.authority_id !== undefined) {
    const aid = body.authority_id;
    if (aid === null || aid === "") {
      patch.authority_id = null; // unroute
    } else if (!UUID.test(aid)) {
      return NextResponse.json({ error: "Invalid authority id." }, { status: 400 });
    } else {
      const { data: exists } = await admin
        .from("authorities")
        .select("id")
        .eq("id", aid)
        .maybeSingle<{ id: string }>();
      if (!exists) return NextResponse.json({ error: "Authority not found." }, { status: 400 });
      patch.authority_id = aid;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await admin
    .from("reports")
    .update(patch as never)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
