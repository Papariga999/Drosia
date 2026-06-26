import { NextResponse } from "next/server";
import { verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminAuthorityRow } from "@/lib/admin/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = ["email", "open311", "none"];

/** GET /api/admin/authorities — directory with pending counts + delivery health. */
export async function GET(): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin().rpc("admin_list_authorities");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ authorities: (data ?? []) as AdminAuthorityRow[] });
}

interface AuthorityInput {
  name_en?: string;
  name_el?: string;
  name_de?: string;
  level?: string;
  country_code?: string;
  email_official?: string | null;
  delivery_channel?: string;
  is_active?: boolean;
  geom_wkt?: string;
}

function buildPayload(body: AuthorityInput) {
  const name_i18n: Record<string, string> = {};
  if (body.name_en) name_i18n.en = body.name_en.trim();
  if (body.name_el) name_i18n.el = body.name_el.trim();
  if (body.name_de) name_i18n.de = body.name_de.trim();

  const payload: Record<string, unknown> = {};
  if (Object.keys(name_i18n).length) payload.name_i18n = name_i18n;
  if (body.level) payload.level = body.level.trim();
  if (body.country_code) payload.country_code = body.country_code.trim().toUpperCase();
  if (body.email_official !== undefined) {
    payload.email_official = body.email_official ? body.email_official.trim() : null;
  }
  if (body.delivery_channel && CHANNELS.includes(body.delivery_channel)) {
    payload.delivery_channel = body.delivery_channel;
  }
  if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
  return payload;
}

/** POST /api/admin/authorities — create. */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: AuthorityInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body.name_en && !body.name_el) {
    return NextResponse.json({ error: "A name (en or el) is required." }, { status: 400 });
  }
  if (!body.country_code) return NextResponse.json({ error: "country_code is required." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const payload = { level: "municipality", delivery_channel: "email", is_active: true, ...buildPayload(body) };
  const { data, error } = await admin
    .from("authorities")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const id = (data as { id: string }).id;
  if (body.geom_wkt) {
    const { error: gErr } = await admin.rpc("set_authority_geom", { p_id: id, p_wkt: body.geom_wkt } as never);
    if (gErr) return NextResponse.json({ id, warning: `geom not set: ${gErr.message}` });
  }
  return NextResponse.json({ id });
}

/** PATCH /api/admin/authorities — update by id. */
export async function PATCH(req: Request): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: AuthorityInput & { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body.id || !UUID.test(body.id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const payload = buildPayload(body);
  if (Object.keys(payload).length) {
    const { error } = await admin.from("authorities").update(payload as never).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.geom_wkt) {
    const { error: gErr } = await admin.rpc("set_authority_geom", { p_id: body.id, p_wkt: body.geom_wkt } as never);
    if (gErr) return NextResponse.json({ ok: true, warning: `geom not set: ${gErr.message}` });
  }
  return NextResponse.json({ ok: true });
}
