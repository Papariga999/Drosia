import type { Locale } from "./i18n";

/** Report categories — must stay in sync with the `report_category` enum in schema.sql. */
export const REPORT_CATEGORIES = [
  "illegal_dump",
  "construction_waste",
  "litter",
  "plastic",
  "tires",
  "appliances",
  "vehicle",
  "green_waste",
  "bulky",
  "coast",
  "sewage",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isReportCategory(v: string): v is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(v);
}

/** Emoji + localized label per category, used in chips, pins and cards. */
export const CATEGORY_META: Record<
  ReportCategory,
  { emoji: string; label: Record<Locale, string> }
> = {
  illegal_dump: {
    emoji: "🗑",
    label: { el: "Παράνομη χωματερή", en: "Illegal dump", de: "Illegale Müllkippe" },
  },
  construction_waste: {
    emoji: "🧱",
    label: { el: "Μπάζα", en: "Construction waste", de: "Bauschutt" },
  },
  litter: {
    emoji: "🚮",
    label: { el: "Σκουπίδια", en: "Litter", de: "Müll" },
  },
  plastic: {
    emoji: "♻️",
    label: { el: "Πλαστικά", en: "Plastic", de: "Plastik" },
  },
  tires: {
    emoji: "🛞",
    label: { el: "Λάστιχα", en: "Tires", de: "Reifen" },
  },
  appliances: {
    emoji: "🧊",
    label: { el: "Συσκευές", en: "Appliances", de: "Elektrogeräte" },
  },
  vehicle: {
    emoji: "🚗",
    label: { el: "Εγκαταλελειμμένο όχημα", en: "Abandoned vehicle", de: "Fahrzeugwrack" },
  },
  green_waste: {
    emoji: "🌳",
    label: { el: "Πράσινα απόβλητα", en: "Green waste", de: "Grünabfall" },
  },
  bulky: {
    emoji: "🛋",
    label: { el: "Ογκώδη", en: "Bulky waste", de: "Sperrmüll" },
  },
  coast: {
    emoji: "🏖",
    label: { el: "Παραλία", en: "Beach litter", de: "Strandmüll" },
  },
  sewage: {
    emoji: "🛢",
    label: { el: "Λύματα / χημικά", en: "Sewage / hazard", de: "Abwasser / Gefahrstoff" },
  },
  other: {
    emoji: "❓",
    label: { el: "Άλλο", en: "Other", de: "Sonstiges" },
  },
};

export function categoryLabel(cat: ReportCategory, locale: Locale): string {
  return CATEGORY_META[cat].label[locale];
}
