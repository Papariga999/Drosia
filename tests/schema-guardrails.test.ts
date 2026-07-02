import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");

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
  });

  it("hides admin-unpublished (admin_hidden) reports from the public view", () => {
    expect(schema).toMatch(/add column if not exists admin_hidden boolean not null default false/i);
    // v_public_reports must exclude admin-hidden reports alongside test reports.
    expect(schema).toMatch(/r\.is_test\s*=\s*false\s+and\s+r\.admin_hidden\s*=\s*false/i);
  });

  it("keeps original uploads private at storage bucket creation", () => {
    expect(schema).toMatch(/'report-originals',\s*'report-originals',\s*false/i);
    expect(schema).toMatch(/'report-public',\s*'report-public',\s*true/i);
  });
});

describe("schema RLS / least-privilege guardrails", () => {
  const baseTables = [
    "countries",
    "authorities",
    "reports",
    "report_photos",
    "delivery_logs",
    "authority_responses",
    "content_flags",
    "anon_devices",
    "report_votes",
    "push_subscriptions",
    "geocode_cache",
    "rate_limits",
    "web_events",
    "web_events_daily",
    "admin_tasks",
  ];

  it("enables row level security on every base table", () => {
    for (const t of baseTables) {
      expect(schema).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`, "i"));
    }
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

  it("records the moderation reject_reason column", () => {
    expect(schema).toMatch(/add column if not exists reject_reason text/i);
  });

  it("rejects out-of-bounds points (strict geofence) in intake_report", () => {
    expect(schema).toMatch(/if v_country is null then\s*raise exception 'OUT_OF_BOUNDS'/i);
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
