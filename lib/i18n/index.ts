import en from "./en.json";
import el from "./el.json";
import de from "./de.json";

/**
 * PUBLIC-APP locales only. Start EL/EN/DE, extensible (FR/IT/ES/HR…).
 * The ADMIN BOARD is English-only and is NOT part of this i18n system.
 */
export const LOCALES = ["el", "en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "el";

/** Short code for the compact/segmented switcher (uppercased ISO-639-1). */
export const LOCALE_LABEL: Record<Locale, string> = { el: "EL", en: "EN", de: "DE" };

/**
 * Native language name (endonym) for the dropdown switcher. A user reads their
 * own language name in their own script, independent of the current UI locale —
 * that's what makes the picker usable once we grow past a few languages.
 * When adding a locale, add its endonym here (fr: "Français", it: "Italiano",
 * es: "Español", hr: "Hrvatski", …).
 */
export const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
  el: "Ελληνικά",
  en: "English",
  de: "Deutsch",
};

const DICTS = { en, el, de } as const;
export type Dict = typeof en;

export function getDict(locale: Locale): Dict {
  return DICTS[locale] as Dict;
}

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/**
 * First-visit locale from a browser `Accept-Language` header (the device/system
 * language). We only ship EL/EN/DE, so the device's top-priority language wins:
 * German → de, Greek → el, and English or anything else → en. Returns "en" when
 * there is no usable header. A saved manual choice still overrides this later.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "en";
  const top = header
    .split(",")
    .map((part) => {
      const segments = part.trim().split(";");
      const tag = segments[0] ?? "";
      const qParam = segments.slice(1).map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { base: tag.trim().toLowerCase().split("-")[0] ?? "", weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((e) => e.base)
    .sort((a, b) => b.weight - a.weight)[0];
  if (!top) return "en";
  if (top.base === "de") return "de";
  if (top.base === "el") return "el";
  return "en";
}

/** Interpolate {placeholders} in a copy string. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
