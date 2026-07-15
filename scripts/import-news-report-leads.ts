/**
 * Import media-derived environmental report leads into Drosia.
 *
 * These are NOT citizen submissions and do NOT include photos. They are inserted
 * as pending reports so they can appear as neutral "in review" map pins, while
 * staying out of the authority scorecard via excluded_from_ranking=true.
 *
 * Usage:
 *   tsx scripts/import-news-report-leads.ts
 *   DRY_RUN=true tsx scripts/import-news-report-leads.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { isReportCategory } from "../lib/categories";

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

type LeadFile = {
  reports: NewsLead[];
};

type NewsLead = {
  id: string;
  country_code: string;
  authority_guess?: { name_en?: string };
  category: string;
  description: string;
  location: { lat: number; lng: number };
  excluded_from_ranking: boolean;
};

type AuthorityRow = {
  id: string;
  name_i18n: Record<string, string> | null;
};

const GREEK_AUTHORITY_BY_EN = new Map<string, string>([
  ["Municipality of Nea Propontida", "Δήμος Νέας Προποντίδας"],
  ["Municipality of Chalkidona", "Δήμος Χαλκηδόνος"],
  ["Municipality of Pella", "Δήμος Πέλλας"],
  ["Municipality of Sithonia", "Δήμος Σιθωνίας"],
  ["Municipality of Kassandra", "Δήμος Κασσάνδρας"],
  ["Municipality of Agistri", "Δήμος Αγκιστρίου"],
  ["Municipality of Milos", "Δήμος Μήλου"],
  ["Municipality of Ziros", "Δήμος Ζηρού"],
  ["Municipality of Aspropyrgos", "Δήμος Ασπροπύργου"],
]);

function tokenFor(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 32);
}

function loadLeads(): NewsLead[] {
  const path = fileURLToPath(new URL("./data/gr-environmental-news-reports-2026-07-02.json", import.meta.url));
  const raw = JSON.parse(readFileSync(path, "utf8")) as LeadFile;
  if (!Array.isArray(raw.reports)) throw new Error("Lead file must contain reports[].");
  return raw.reports.map((lead, index) => {
    if (!lead.id) throw new Error(`reports[${index}]: missing id.`);
    if (lead.country_code !== "GR") throw new Error(`${lead.id}: expected country_code=GR.`);
    if (!isReportCategory(lead.category)) throw new Error(`${lead.id}: invalid category ${lead.category}.`);
    if (!lead.description || lead.description.length > 500) {
      throw new Error(`${lead.id}: description must be 1..500 chars.`);
    }
    if (!Number.isFinite(lead.location?.lat) || !Number.isFinite(lead.location?.lng)) {
      throw new Error(`${lead.id}: invalid location.`);
    }
    if (lead.excluded_from_ranking !== true) {
      throw new Error(`${lead.id}: news-derived leads must be excluded_from_ranking=true.`);
    }
    return lead;
  });
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.env.DRY_RUN === "true";

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const leads = loadLeads();
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: country, error: countryError } = await db
    .from("countries")
    .select("code, is_active")
    .eq("code", "GR")
    .maybeSingle<{ code: string; is_active: boolean }>();

  if (countryError || !country?.is_active) {
    console.error(countryError?.message ?? "Country GR is missing or inactive.");
    process.exit(1);
  }

  const { data: authorities, error: authorityError } = await db
    .from("authorities")
    .select("id, name_i18n")
    .eq("country_code", "GR")
    .eq("level", "municipality")
    .returns<AuthorityRow[]>();

  if (authorityError) {
    console.error(`Could not read authorities: ${authorityError.message}`);
    process.exit(1);
  }

  const authorityIdByGreekName = new Map<string, string>();
  for (const authority of authorities ?? []) {
    const el = authority.name_i18n?.el;
    if (el) authorityIdByGreekName.set(el, authority.id);
  }

  const rows = leads.map((lead) => {
    const authorityGreekName = GREEK_AUTHORITY_BY_EN.get(lead.authority_guess?.name_en ?? "");
    const authorityId = authorityGreekName ? authorityIdByGreekName.get(authorityGreekName) ?? null : null;

    return {
      public_token: tokenFor(lead.id),
      country_code: "GR",
      authority_id: authorityId,
      category: lead.category,
      description: lead.description,
      geom: `SRID=4326;POINT(${lead.location.lng} ${lead.location.lat})`,
      status: "submitted",
      locale: "el",
      author_token: null,
      is_test: false,
      excluded_from_ranking: true,
      admin_hidden: false,
    };
  });

  const unresolvedAuthorities = rows.filter((row) => !row.authority_id).length;
  console.log(
    `${dryRun ? "Dry run" : "Importing"} ${rows.length} news-derived report leads ` +
      `(${unresolvedAuthorities} without matched authority).`,
  );

  if (dryRun) {
    for (const row of rows) {
      console.log(`${row.public_token} ${row.category} authority=${row.authority_id ?? "null"}`);
    }
    return;
  }

  const { data: upserted, error: upsertError } = await db
    .from("reports")
    .upsert(rows as never, { onConflict: "public_token" })
    .select("id, public_token, authority_id")
    .returns<{ id: string; public_token: string; authority_id: string | null }[]>();

  if (upsertError || !upserted) {
    console.error(`Import failed: ${upsertError?.message ?? "no rows returned"}`);
    process.exit(1);
  }

  console.log(
    `Import complete: ${upserted.length} upserted. ` +
      `Tokens: ${upserted.map((row) => row.public_token).join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
