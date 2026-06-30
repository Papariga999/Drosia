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

  // After mount, a previously saved manual choice overrides the server-detected
  // `initialLocale` (which came from the device's Accept-Language). Syncing here
  // — rather than during render — is what avoids an SSR/client mismatch. Either
  // way we set <html lang> to the effective locale for assistive tech.
  useEffect(() => {
    let effective: Locale = initialLocale;
    try {
      const saved = window.localStorage.getItem("drosia.locale");
      if (saved && isLocale(saved)) {
        effective = saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocaleState(saved);
      }
      document.documentElement.lang = effective;
    } catch {
      /* ignore storage failures */
    }
  }, [initialLocale]);

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
