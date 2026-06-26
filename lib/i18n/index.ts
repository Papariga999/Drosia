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

export const LOCALE_LABEL: Record<Locale, string> = { el: "EL", en: "EN", de: "DE" };

const DICTS = { en, el, de } as const;
export type Dict = typeof en;

export function getDict(locale: Locale): Dict {
  return DICTS[locale] as Dict;
}

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** Interpolate {placeholders} in a copy string. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}
