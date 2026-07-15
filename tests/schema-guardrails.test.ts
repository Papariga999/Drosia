import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");
const rlsRemediation = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260715000000_fix_rls_disabled_in_public.sql",
  ),
  "utf8",
);

describe("schema phase 0 guardrails", () => {
  it("never uses destructive table drops", () => {
    expect(schema).not.toMatch(/\bdrop\s+table\b/i);
  });

  it("keeps the report description limit at the architecture cap", () => {
    expect(schema).toMatch(/char_length\(description\)\s*<=\s*500/i);
  });

  it("requires anonymized public photos before public reports are exposed", () => {
    expect(schema).toMatch(/create\s+or\s+replace\s+view\s+v_public_reports/i);
    expect(schema).toMatch(/exists\s*\(\s*select\s+1\s+from\s+report_photos/i);
    expect(schema).toMatch(/ph\.blur_status\s*=\s*'done'/i);
    expect(schema).toMatch(/ph\.public_path\s+is\s+not\s+null/i);
    expect(schema).toMatch(
      /not\s+exists\s*\([\s\S]*?from\s+report_photos\s+ph[\s\S]*?ph\.blur_status\s*<>\s*'done'[\s\S]*?ph\.public_path\s+is\s+null/i,
    );
  });

  it("never exposes submitted reports or pending pins", () => {
    expect(schema).toMatch(
      /create\s+or\s+replace\s+view\s+v_pending_report_pins[\s\S]*?where\s+false\s*;/i,
    );
    expect(schema).not.toMatch(/grant\s+select\s+on\s+v_pending_report_pins/i);
  });

  it("hides admin-unpublished (admin_hidden) reports from the public view", () => {
    expect(schema).toMatch(/add column if not exists admin_hidden boolean not null default false/i);
    // v_public_reports must exclude admin-hidden reports alongside test reports.
    expect(schema).toMatch(/r\.is_test\s*=\s*false\s+and\s+r\.admin_hidden\s*=\s*false/i);
  });

  it("only exposes reports, photos, and authorities from active countries", () => {
    const activeCountryReportGates = schema.match(
      /select\s+1\s+from\s+countries\s+c\s+where\s+c\.code\s*=\s*r\.country_code\s+and\s+c\.is_active\s*=\s*true/gi,
    );
    expect(activeCountryReportGates).toHaveLength(2);
    expect(schema).toMatch(
      /create\s+or\s+replace\s+view\s+v_public_authorities[\s\S]*?join\s+countries\s+c\s+on\s+c\.code\s*=\s*a\.country_code\s+and\s+c\.is_active\s*=\s*true/i,
    );
  });

  it("keeps original uploads private at storage bucket creation", () => {
    expect(schema).toMatch(/'report-originals',\s*'report-originals',\s*false/i);
    expect(schema).toMatch(/'report-public',\s*'report-public',\s*true/i);
    expect(schema).toMatch(
      /values\s*\('report-originals',[\s\S]*?on conflict\s*\(id\)\s*do update[\s\S]*?public\s*=\s*false/i,
    );
  });

  it("can rebuild a real country geofence from active authority polygons", () => {
    expect(schema).toMatch(
      /create\s+or\s+replace\s+function\s+refresh_country_boundary_from_authorities/i,
    );
    const importer = readFileSync(
      join(process.cwd(), "scripts", "import-gr-boundaries.ts"),
      "utf8",
    );
    expect(importer).toMatch(/\.rpc\(\s*"refresh_country_boundary_from_authorities"/i);
  });
});

describe("schema RLS / least-privilege guardrails", () => {
  const baseTables = Array.from(
    schema.matchAll(/create\s+table\s+if\s+not\s+exists\s+([a-z0-9_]+)/gi),
    (match) => match[1]!,
  );

  it("enables row level security on every base table", () => {
    expect(baseTables).toContain("support_leads");
    for (const t of baseTables) {
      expect(schema).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`, "i"));
    }
  });

  it("ships an idempotent live-database RLS remediation for every base table", () => {
    expect(rlsRemediation).not.toMatch(/\bdrop\s+table\b/i);
    expect(rlsRemediation).toMatch(/to_regclass\(/i);
    expect(rlsRemediation).toMatch(/enable row level security/i);
    expect(rlsRemediation).toMatch(/force row level security/i);
    expect(rlsRemediation).toMatch(
      /revoke all on table public\.%I from public, anon, authenticated/i,
    );
    for (const table of baseTables) {
      expect(rlsRemediation).toMatch(new RegExp(`'${table}'`, "i"));
    }
  });

  it("explicitly revokes API-role access to every base table", () => {
    const revokeBlock = schema.match(
      /revoke\s+all\s+on\s+table\s+([\s\S]*?)from\s+public,\s*anon,\s*authenticated\s*;/i,
    )?.[1];
    expect(revokeBlock).toBeTruthy();
    for (const table of baseTables) expect(revokeBlock).toMatch(new RegExp(`\\b${table}\\b`, "i"));
    expect(schema).toMatch(
      /alter\s+default\s+privileges\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+tables\s+from\s+public,\s*anon,\s*authenticated/i,
    );
  });

  it("only ever grants public read on the safe views, never on base tables", () => {
    const grants = schema.match(/grant\s+select\s+on\s+(\S+)\s+to\s+anon/gi) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) {
      expect(g).toMatch(/grant\s+select\s+on\s+v_/i); // v_public_reports / v_public_report_photos / v_authority_scorecard
    }
    // Originals and author tokens must never be exposed to anon directly.
    expect(schema).not.toMatch(/grant\s+select\s+on\s+reports\s+to\s+anon/i);
    expect(schema).not.toMatch(/grant\s+select\s+on\s+report_photos\s+to\s+anon/i);
  });

  it("revokes mutating/admin RPCs from anon and authenticated", () => {
    for (const fn of [
      "intake_report",
      "rate_limit_hit",
      "admin_list_reports",
      "admin_web_analytics",
      "admin_report_analytics",
      "web_events_maintenance",
    ]) {
      expect(schema).toMatch(new RegExp(`revoke all on function ${fn}[^;]*from anon, authenticated`, "i"));
    }
  });

  it("revokes broad view privileges before granting SELECT only", () => {
    expect(schema).toMatch(
      /revoke\s+all\s+on\s+v_public_reports[\s\S]*?from\s+public,\s*anon,\s*authenticated/i,
    );
    expect(schema).toMatch(/v_public_reports\s+with\s*\(security_barrier\s*=\s*true\)/i);
  });

  it("records the moderation reject_reason column", () => {
    expect(schema).toMatch(/add column if not exists reject_reason text/i);
  });

  it("rejects out-of-bounds points (strict geofence) in intake_report", () => {
    expect(schema).toMatch(/if v_country is null then\s*raise exception 'OUT_OF_BOUNDS'/i);
    expect(schema).toMatch(/and is_test\s*=\s*false[\s\S]*?and geom is not null/i);
  });

  it("enforces country/authority integrity and the report state machine", () => {
    expect(schema).toMatch(/constraint reports_country_required/i);
    expect(schema).toMatch(/constraint reports_authority_country_fk/i);
    expect(schema).toMatch(/create\s+or\s+replace\s+function\s+enforce_report_state_machine/i);
    expect(schema).toMatch(/old\.status\s*=\s*'notified'\s+and\s+new\.status\s+in\s*\('resolved','rejected'\)/i);
    expect(schema).toMatch(/NOTIFIED_AT_REQUIRED/);
  });

  it("counts only genuinely notified, non-test authorities in the scorecard", () => {
    expect(schema).toMatch(/r\.notified_at\s+is\s+not\s+null/i);
    expect(schema).toMatch(/where a\.is_active\s*=\s*true\s+and\s+a\.is_test\s*=\s*false/i);
  });

  it("dedupes votes per device per type", () => {
    expect(schema).toMatch(/unique\s*\(report_id,\s*voter_token,\s*type\)/i);
  });
});

describe("code ↔ schema drift guardrail", () => {
  // Every table/view (.from("…")) and RPC (.rpc("…")) the runtime code touches
  // must be defined in schema.sql — the single source of truth. This is exactly
  // the failure mode that once let reject_reason / web_events exist only in the
  // live DB: a fresh clone + schema.sql produced a database the code couldn't run
  // against. Storage buckets (hyphenated names) are exempt — different namespace.
  function collectSourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collectSourceFiles(full, acc);
      else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".d.ts")) acc.push(full);
    }
    return acc;
  }

  const sources = [join(process.cwd(), "app"), join(process.cwd(), "lib")]
    .flatMap((d) => collectSourceFiles(d))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("defines every table/view the code reads or writes", () => {
    const referenced = new Set<string>();
    for (const m of sources.matchAll(/\.from\(\s*"([a-z0-9_]+)"\s*\)/g)) referenced.add(m[1]!);

    for (const name of referenced) {
      const defined =
        new RegExp(`create table if not exists ${name}\\b`, "i").test(schema) ||
        new RegExp(`create or replace view ${name}\\b`, "i").test(schema);
      expect(defined, `"${name}" is used via .from() but not defined in schema.sql`).toBe(true);
    }
    expect(referenced.size).toBeGreaterThan(0);
  });

  it("defines every RPC the code calls", () => {
    const referenced = new Set<string>();
    for (const m of sources.matchAll(/\.rpc\(\s*"([a-z0-9_]+)"/g)) referenced.add(m[1]!);

    for (const name of referenced) {
      const defined = new RegExp(`create or replace function ${name}\\s*\\(`, "i").test(schema);
      expect(defined, `RPC "${name}" is called via .rpc() but not defined in schema.sql`).toBe(true);
    }
    expect(referenced.size).toBeGreaterThan(0);
  });
});

describe("public data-access guardrails", () => {
  it("uses the anon client for public authority pages", () => {
    const source = readFileSync(join(process.cwd(), "lib", "authority.ts"), "utf8");
    expect(source).toMatch(/getSupabasePublic/);
    expect(source).not.toMatch(/getSupabaseAdmin/);
    expect(source).not.toMatch(/\.from\(\s*"authorities"\s*\)/);
  });

  it("gates votes and DSA flags through the publish-safe report view", () => {
    for (const route of [
      join(process.cwd(), "app", "api", "vote", "route.ts"),
      join(process.cwd(), "app", "api", "flag", "route.ts"),
    ]) {
      expect(readFileSync(route, "utf8")).toMatch(/\.from\(\s*"v_public_reports"\s*\)/);
    }
  });

  it("keeps development authority fixtures marked as test data", () => {
    const seed = readFileSync(join(process.cwd(), "scripts", "seed.ts"), "utf8");
    expect(seed).toMatch(/is_test:\s*true/);
    expect(seed).not.toMatch(/is_test:\s*false/);
  });
});

describe("delivery webhook guardrails", () => {
  it("deduplicates provider events and ignores stale status updates", () => {
    expect(schema).toMatch(/create table if not exists delivery_webhook_events/i);
    expect(schema).toMatch(/primary key \(provider, provider_event_id\)/i);
    expect(schema).toMatch(/create or replace function apply_delivery_webhook\s*\(/i);
    expect(schema).toMatch(/provider_status_at is null or provider_status_at < p_event_at/i);
  });

  it("advances ranking status only on confirmed email delivery", () => {
    expect(schema).toMatch(/if p_status = 'delivered' then[\s\S]*?set status = 'notified'/i);
    expect(schema).not.toMatch(/if p_status = 'sent' then[\s\S]*?set status = 'notified'/i);
  });
});
