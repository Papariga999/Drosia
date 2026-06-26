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
