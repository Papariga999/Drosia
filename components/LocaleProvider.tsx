"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DEFAULT_LOCALE, getDict, isLocale, type Dict, type Locale } from "@/lib/i18n";

type Ctx = { locale: Locale; dict: Dict; setLocale: (l: Locale) => void };

const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Restore the visitor's previous choice (no account — just localStorage).
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("drosia.locale") : null;
    // One-time hydration from localStorage after mount: rendering the default
    // first (then syncing) is what avoids an SSR/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && isLocale(saved)) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem("drosia.locale", l);
      document.documentElement.lang = l;
    } catch {
      /* ignore storage failures */
    }
  }, []);

  return (
    <LocaleCtx.Provider value={{ locale, dict: getDict(locale), setLocale }}>
      {children}
    </LocaleCtx.Provider>
  );
}

export function useLocale(): Ctx {
  const ctx = useContext(LocaleCtx);
  if (!ctx) throw new Error("useLocale must be used within <LocaleProvider>");
  return ctx;
}
