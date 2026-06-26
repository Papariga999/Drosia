/**
 * Drosia seed — DEV ONLY. Guarded by SEED_ENV === "dev".
 * Demo data MUST be is_test=true and is excluded from every public view/aggregate.
 * Real GR authorities (the 332 δήμοι) are seeded via a separate real-data import and
 * must NOT be is_test. Never run against production.
 */
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Load .env.local into process.env (tsx doesn't auto-load env files). Skips
 * comments and strips trailing inline comments; never overrides an existing var.
 */
function loadEnvLocal(file = ".env.local"): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    const key = m?.[1];
    if (!key || m?.[2] === undefined) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      const c = val.indexOf(" #");
      if (c >= 0) val = val.slice(0, c).trim();
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("Refusing to seed: production environment detected.");
    process.exit(1);
  }

  if (process.env.SEED_ENV !== "dev") {
    console.error('Refusing to seed: set SEED_ENV="dev" to run. (Never seed production.)');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Activate Greece.
  const { error } = await db.from("countries").upsert(
    {
      code: "GR",
      name_i18n: { el: "Ελλάδα", en: "Greece", de: "Griechenland" },
      default_locale: "el",
      locales: ["el", "en", "de"],
      is_active: true,
    },
    { onConflict: "code" },
  );
  if (error) throw error;

  // PLACEHOLDER geofence boundary so the intake RPC (ST_Covers) works end-to-end
  // in dev: a coarse bbox over the Greek mainland + islands. Lets Athens IN and
  // Berlin/open-sea OUT (the Phase-1 geofence test). REPLACE with the real
  // GR MultiPolygon GeoJSON before launch — this is intentionally rough.
  const GR_BBOX_WKT =
    "SRID=4326;MULTIPOLYGON(((19.3 34.8,29.7 34.8,29.7 41.8,19.3 41.8,19.3 34.8)))";
  const { error: boundaryError } = await db.rpc("set_country_boundary", {
    p_code: "GR",
    p_wkt: GR_BBOX_WKT,
  });
  if (boundaryError) {
    console.warn(
      `Could not set GR boundary via RPC (${boundaryError.message}). ` +
        "Geofence will reject all points until a boundary is loaded.",
    );
  }

  // Two REAL Dodecanese authorities (NOT is_test) with rough coverage polygons so
  // authority routing (ST_Contains) assigns them. Replace the rough boxes with
  // real municipal polygons before launch. Idempotent via email as natural key.
  const AUTHORITIES: { nameI18n: Record<string, string>; email: string; wkt: string }[] = [
    {
      nameI18n: { el: "Δήμος Ρόδου", en: "Municipality of Rhodes", de: "Gemeinde Rhodos" },
      email: "perivallon@rhodes.example.gr",
      wkt: "SRID=4326;MULTIPOLYGON(((27.7 36.0,28.4 36.0,28.4 36.55,27.7 36.55,27.7 36.0)))",
    },
    {
      nameI18n: { el: "Δήμος Κω", en: "Municipality of Kos", de: "Gemeinde Kos" },
      email: "info@kos.example.gr",
      wkt: "SRID=4326;MULTIPOLYGON(((26.9 36.7,27.45 36.7,27.45 37.05,26.9 37.05,26.9 36.7)))",
    },
  ];

  for (const a of AUTHORITIES) {
    const { data: existing } = await db
      .from("authorities")
      .select("id")
      .eq("email_official", a.email)
      .maybeSingle();

    let id = (existing as { id: string } | null)?.id;
    if (!id) {
      const { data: inserted, error: insErr } = await db
        .from("authorities")
        .insert({
          country_code: "GR",
          name_i18n: a.nameI18n,
          level: "municipality",
          delivery_channel: "email",
          email_official: a.email,
          is_active: true,
          is_test: false,
        })
        .select("id")
        .single();
      if (insErr) {
        console.warn(`Could not insert authority ${a.email}: ${insErr.message}`);
        continue;
      }
      id = (inserted as { id: string }).id;
    }

    const { error: geomErr } = await db.rpc("set_authority_geom", { p_id: id, p_wkt: a.wkt });
    if (geomErr) console.warn(`Could not set geom for ${a.email}: ${geomErr.message}`);
  }

  console.log(
    "Seed (dev) complete: Greece active (placeholder boundary) + 2 real authorities with coverage polygons.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
