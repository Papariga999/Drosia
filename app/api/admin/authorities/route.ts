import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminMutation, verifySession } from "@/lib/admin/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AdminAuthorityRow } from "@/lib/admin/types";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const localizedNamesSchema = z.record(
  z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
  z.string().trim().min(1).max(200),
);

const authorityFields = {
  name_i18n: localizedNamesSchema.optional(),
  name_en: z.string().trim().max(200).optional(),
  name_el: z.string().trim().max(200).optional(),
  name_de: z.string().trim().max(200).optional(),
  level: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/).optional(),
  country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  email_official: z.union([z.string().trim().email().max(320), z.literal(""), z.null()]).optional(),
  delivery_channel: z.enum(["email", "open311", "none"]).optional(),
  open311_endpoint: z.union([z.string().trim().url().max(1000), z.literal(""), z.null()]).optional(),
  open311_jurisdiction: z.union([z.string().trim().max(200), z.null()]).optional(),
  is_active: z.boolean().optional(),
  geom_wkt: z.string().trim().max(500_000).optional(),
};

const createSchema = z
  .object(authorityFields)
  .strict()
  .superRefine((value, ctx) => {
    const hasName =
      !!Object.keys(value.name_i18n ?? {}).length || !!value.name_en || !!value.name_el || !!value.name_de;
    if (!hasName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one localized name is required." });
    if (!value.country_code) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "country_code is required." });
  });

const patchSchema = z
  .object({ id: z.string().uuid(), ...authorityFields })
  .strict()
  .refine((value) => Object.keys(value).some((key) => key !== "id"), "Nothing to update.");

type AuthorityInput = z.infer<typeof createSchema> | z.infer<typeof patchSchema>;

function namesFrom(body: AuthorityInput): Record<string, string> {
  const names = { ...(body.name_i18n ?? {}) };
  if (body.name_en) names.en = body.name_en;
  if (body.name_el) names.el = body.name_el;
  if (body.name_de) names.de = body.name_de;
  return names;
}

function buildPayload(body: AuthorityInput, existingNames: Record<string, string> = {}) {
  const names = namesFrom(body);
  const payload: Record<string, unknown> = {};
  if (Object.keys(names).length) payload.name_i18n = { ...existingNames, ...names };
  if (body.level !== undefined) payload.level = body.level;
  if (body.country_code !== undefined) payload.country_code = body.country_code;
  if (body.email_official !== undefined) payload.email_official = body.email_official || null;
  if (body.delivery_channel !== undefined) payload.delivery_channel = body.delivery_channel;
  if (body.open311_endpoint !== undefined) payload.open311_endpoint = body.open311_endpoint || null;
  if (body.open311_jurisdiction !== undefined) {
    payload.open311_jurisdiction = body.open311_jurisdiction || null;
  }
  if (body.is_active !== undefined) payload.is_active = body.is_active;
  return payload;
}

async function countryExists(code: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("countries")
    .select("code")
    .eq("code", code)
    .maybeSingle<{ code: string }>();
  return !error && !!data;
}

/** Directory with pending counts and delivery health. */
export async function GET(): Promise<Response> {
  if (!(await verifySession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await getSupabaseAdmin().rpc("admin_list_authorities");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ authorities: (data ?? []) as AdminAuthorityRow[] });
}

/** Create an authority. Country and localized names are data, never constants. */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await readJsonBody(req, 512 * 1024);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const body = parsed.data;
  if (!(await countryExists(body.country_code!))) {
    return NextResponse.json({ error: "Unknown country_code." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const payload = {
    level: "municipality",
    delivery_channel: "email",
    is_active: true,
    ...buildPayload(body),
  };
  const { data, error } = await admin
    .from("authorities")
    .insert(payload as never)
    .select("id")
    .single<{ id: string }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.geom_wkt) {
    const { error: geomError } = await admin.rpc("set_authority_geom", {
      p_id: data.id,
      p_wkt: body.geom_wkt,
    } as never);
    if (geomError) {
      const { error: rollbackError } = await admin.from("authorities").delete().eq("id", data.id);
      if (rollbackError) {
        return NextResponse.json(
          { error: `Geometry failed and authority rollback failed: ${rollbackError.message}` },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: `Invalid authority geometry: ${geomError.message}` }, { status: 400 });
    }
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

/** Update an authority without discarding unedited locale names. */
export async function PATCH(req: Request): Promise<Response> {
  if (!(await verifyAdminMutation(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await readJsonBody(req, 512 * 1024);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed." }, { status: 400 });
  const body = parsed.data;
  if (body.country_code && !(await countryExists(body.country_code))) {
    return NextResponse.json({ error: "Unknown country_code." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: loadError } = await admin
    .from("authorities")
    .select("id, name_i18n")
    .eq("id", body.id)
    .maybeSingle<{ id: string; name_i18n: Record<string, string> }>();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Authority not found." }, { status: 404 });

  const payload = buildPayload(body, existing.name_i18n ?? {});
  if (Object.keys(payload).length) {
    const { error } = await admin.from("authorities").update(payload as never).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.geom_wkt) {
    const { error: geomError } = await admin.rpc("set_authority_geom", {
      p_id: body.id,
      p_wkt: body.geom_wkt,
    } as never);
    if (geomError) {
      return NextResponse.json({ error: `Invalid authority geometry: ${geomError.message}` }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
