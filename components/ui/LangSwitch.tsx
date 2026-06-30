"use client";

import { LOCALES, LOCALE_LABEL } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

/** Scalable EL/EN/DE segmented language switch. */
export function LangSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface p-1">
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`rounded-[9px] px-3 py-2 font-display text-[13px] font-extrabold transition-colors ${
              active ? "bg-primary text-white" : "text-slate hover:text-ink"
            }`}
          >
            {LOCALE_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
