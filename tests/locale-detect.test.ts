import { describe, it, expect } from "vitest";
import { localeFromAcceptLanguage } from "@/lib/i18n";

describe("localeFromAcceptLanguage (device/system language → EL/EN/DE)", () => {
  it("maps a German device to de", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(localeFromAcceptLanguage("de-AT")).toBe("de");
  });

  it("maps a Greek device to el", () => {
    expect(localeFromAcceptLanguage("el-GR,el;q=0.9,en;q=0.8")).toBe("el");
    expect(localeFromAcceptLanguage("el")).toBe("el");
  });

  it("maps an English device to en", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
  });

  it("falls back to en for any other primary language", () => {
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("it-IT")).toBe("en");
    expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("en");
  });

  it("honors q-weights, not header order, when picking the primary", () => {
    // English listed first but de has the higher weight → de wins.
    expect(localeFromAcceptLanguage("en;q=0.5,de;q=0.9")).toBe("de");
    // A non-supported primary (fr) outranks a supported secondary → en.
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.9")).toBe("en");
  });

  it("defaults to en when the header is missing or empty", () => {
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeFromAcceptLanguage(undefined)).toBe("en");
    expect(localeFromAcceptLanguage("")).toBe("en");
  });
});
