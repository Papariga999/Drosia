import { readFileSync } from "node:fs";
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
    for (const fn of ["intake_report", "rate_limit_hit", "admin_list_reports"]) {
      expect(schema).toMatch(new RegExp(`revoke all on function ${fn}[^;]*from anon, authenticated`, "i"));
    }
  });

  it("rejects out-of-bounds points (strict geofence) in intake_report", () => {
    expect(schema).toMatch(/if v_country is null then\s*raise exception 'OUT_OF_BOUNDS'/i);
  });

  it("dedupes votes per device per type", () => {
    expect(schema).toMatch(/unique\s*\(report_id,\s*voter_token,\s*type\)/i);
  });
});
