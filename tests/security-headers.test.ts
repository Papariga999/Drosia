import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");

describe("security headers", () => {
  it("keeps map tiles usable without leaking report-token URLs cross-origin", () => {
    expect(nextConfig).toMatch(/Referrer-Policy",\s*value:\s*"strict-origin-when-cross-origin"/);
    expect(nextConfig).not.toMatch(/Referrer-Policy",\s*value:\s*"no-referrer"/);
  });
});
