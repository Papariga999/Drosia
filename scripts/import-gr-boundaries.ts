/**
 * Drosia — import REAL Greek municipality COVERAGE POLYGONS so reports auto-route
 * to the responsible authority (ST_Contains) and the admin board's "no polygon"
 * tags disappear.
 *
 * Source: scripts/data/gr-municipality-boundaries.geojson — derived from
 * OpenStreetMap admin_level=7 (δήμος) boundary relations (ODbL), assembled and
 * simplified (~100 m tolerance, ~1.2M → ~68k vertices). Each feature is keyed by
 * `name_el`, matched 1:1 to the authorities seeded by import-gr-authorities.ts
 * (Greek-to-Greek name match; 10 καθαρεύουσα/δημοτική spelling variants resolved
 * via an OSM-relation alias map at build time). Only Δήμος Μεγίστης (Kastellorizo)
 * has no OSM admin_level=7 relation and stays without a polygon.
 *
 * Idempotent: re-running overwrites each matched authority's geom with the same
 * shape. Geometry is repaired + coerced to MultiPolygon server-side
 * (set_authority_geom_geojson → ST_MakeValid/ST_Multi).
 *
 * Usage:  npm run seed:boundaries
 *   (requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

interface BoundaryFeature {
  properties: { name_el: string; osm_id: number };
  geometry: unknown;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const path = fileURLToPath(new URL("./data/gr-municipality-boundaries.geojson", import.meta.url));
  const fc = JSON.parse(readFileSync(path, "utf8")) as { features: BoundaryFeature[] };
  console.log(`Loaded ${fc.features.length} municipality polygons.`);

  // Map authority name (name_i18n->>'el') → id. Only GR municipalities.
  const { data: rows, error } = await db
    .from("authorities")
    .select("id, name_i18n")
    .eq("country_code", "GR")
    .eq("level", "municipality");
  if (error) {
    console.error(`Could not read authorities: ${error.message}`);
    process.exit(1);
  }
  const idByName = new Map<string, string>();
  for (const a of (rows ?? []) as { id: string; name_i18n: Record<string, string> | null }[]) {
    const el = a.name_i18n?.el;
    if (el) idByName.set(el, a.id);
  }

  let stored = 0;
  const unmatched: string[] = [];
  for (const f of fc.features) {
    const id = idByName.get(f.properties.name_el);
    if (!id) {
      unmatched.push(f.properties.name_el);
      continue;
    }
    const { error: gErr } = await db.rpc("set_authority_geom_geojson", {
      p_id: id,
      p_geojson: JSON.stringify(f.geometry),
    } as never);
    if (gErr) {
      console.error(`  geom failed for ${f.properties.name_el}: ${gErr.message}`);
      continue;
    }
    stored++;
    if (stored % 50 === 0) console.log(`  … ${stored} stored`);
  }

  console.log(`Boundary import complete: ${stored} polygons stored.`);
  if (unmatched.length) {
    console.log(`No matching authority for ${unmatched.length}: ${unmatched.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
