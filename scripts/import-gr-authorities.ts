/**
 * Drosia — import REAL Greek municipality authorities (the ~332 δήμοι) with their
 * official contact emails into the `authorities` table, so the Admin-Board's
 * Authority Directory and the auto-mail flow have real recipients from day one.
 *
 * This is the "separate real-data import" referenced in scripts/seed.ts:
 *   - rows are is_test=false (REAL data — they DO count in production)
 *   - it is NOT guarded by SEED_ENV=dev; it is meant to run against production too
 *   - it is idempotent: re-runs insert only what's missing and refresh changed emails
 *
 * Source: scripts/data/gr-municipalities.json — { name_el, email_official }[],
 * sourced from municipal websites / public directories (carried over from the
 * predecessor project). One δήμος has no public email yet; it is imported with
 * email_official=null so it surfaces under the board's "⚠ Missing email" filter.
 *
 * Coverage polygons (geom) are intentionally NOT set here — these authorities are
 * a contact directory. Auto-routing (ST_Contains) only kicks in once an operator
 * attaches a polygon. Until then a report routes to authority_id=null and the
 * operator can assign it by hand.
 *
 * Usage:  npm run seed:authorities
 *   (requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

interface Municipality {
  name_el: string;
  email_official: string;
}

/** Read + validate the source list. Throws on a malformed file. */
function loadMunicipalities(): Municipality[] {
  const path = fileURLToPath(new URL("./data/gr-municipalities.json", import.meta.url));
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) throw new Error("gr-municipalities.json: expected an array.");
  return raw.map((r, i) => {
    const row = r as Partial<Municipality>;
    const nameEl = (row.name_el ?? "").trim();
    if (!nameEl) throw new Error(`gr-municipalities.json[${i}]: missing name_el.`);
    return { name_el: nameEl, email_official: (row.email_official ?? "").trim() };
  });
}

interface AuthorityRow {
  id: string;
  name_i18n: Record<string, string> | null;
  email_official: string | null;
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
  const munis = loadMunicipalities();
  console.log(`Loaded ${munis.length} Greek municipalities from gr-municipalities.json.`);

  // FK guard: authorities.country_code → countries.code. Ensure GR exists, but
  // never clobber an existing row (it may already hold the real boundary).
  const { data: gr } = await db.from("countries").select("code").eq("code", "GR").maybeSingle();
  if (!gr) {
    const { error: cErr } = await db.from("countries").insert({
      code: "GR",
      name_i18n: { el: "Ελλάδα", en: "Greece", de: "Griechenland" },
      default_locale: "el",
      locales: ["el", "en", "de"],
      is_active: true,
    } as never);
    if (cErr) {
      console.error(`Could not create the GR country row: ${cErr.message}`);
      process.exit(1);
    }
    console.log("Created the GR country row (boundary still unset — run the geofence seed separately).");
  }

  // Idempotency key = the Greek name (name_i18n->>'el'). Fetch existing GR
  // municipalities once, then diff against the source list.
  const { data: existingData, error: exErr } = await db
    .from("authorities")
    .select("id, name_i18n, email_official")
    .eq("country_code", "GR")
    .eq("level", "municipality");
  if (exErr) {
    console.error(`Could not read existing authorities: ${exErr.message}`);
    process.exit(1);
  }
  const byName = new Map<string, AuthorityRow>();
  for (const a of (existingData ?? []) as AuthorityRow[]) {
    const el = a.name_i18n?.el;
    if (el) byName.set(el, a);
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; email: string | null }[] = [];
  let unchanged = 0;
  let missingEmail = 0;

  for (const m of munis) {
    const email = m.email_official || null;
    if (!email) missingEmail++;
    const existing = byName.get(m.name_el);
    if (existing) {
      if ((existing.email_official ?? null) !== email) toUpdate.push({ id: existing.id, email });
      else unchanged++;
    } else {
      toInsert.push({
        country_code: "GR",
        name_i18n: { el: m.name_el },
        level: "municipality",
        delivery_channel: "email",
        email_official: email,
        is_active: true,
        is_auto_created: false,
        is_test: false,
      });
    }
  }

  // Insert in chunks so a single large payload doesn't get rejected.
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await db.from("authorities").insert(chunk as never);
    if (error) {
      console.error(`Insert failed at chunk ${i}: ${error.message}`);
      process.exit(1);
    }
    inserted += chunk.length;
  }

  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await db
      .from("authorities")
      .update({ email_official: u.email } as never)
      .eq("id", u.id);
    if (error) {
      console.error(`Email update failed for ${u.id}: ${error.message}`);
      process.exit(1);
    }
    updated++;
  }

  console.log(
    `Import complete: ${inserted} inserted, ${updated} email-updated, ${unchanged} unchanged ` +
      `(${missingEmail} still without an email — visible under the board's "Missing email" filter).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
