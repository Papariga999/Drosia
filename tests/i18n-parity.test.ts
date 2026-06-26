import { describe, it, expect } from "vitest";
import en from "@/lib/i18n/en.json";
import el from "@/lib/i18n/el.json";
import de from "@/lib/i18n/de.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? keys(v as Record<string, unknown>, path)
      : [path];
  });
}

// The public-app dictionaries must have identical key sets (no silent fallbacks).
describe("i18n key parity (public app)", () => {
  const enKeys = keys(en).sort();
  it("el matches en", () => {
    expect(keys(el).sort()).toEqual(enKeys);
  });
  it("de matches en", () => {
    expect(keys(de).sort()).toEqual(enKeys);
  });
});
