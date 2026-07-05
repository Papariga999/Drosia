"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LOCALES, LOCALE_LABEL, LOCALE_NATIVE_LABEL, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Language switcher that scales with the number of locales.
 *
 * Up to {@link SEGMENTED_MAX} languages it's a segmented control — every option
 * visible, one tap to switch, best-possible UX for a short list. Beyond that it
 * becomes a globe dropdown so the header never overflows and the list can grow
 * to 10+ without touching the layout. Adding a locale to `LOCALES` is all it
 * takes; this component picks the right presentation automatically.
 */
const SEGMENTED_MAX = 4;

export function LangSwitch() {
  return LOCALES.length <= SEGMENTED_MAX ? <SegmentedSwitch /> : <LangMenu />;
}

/** Compact inline control for a short list of languages (current EL/EN/DE case). */
function SegmentedSwitch() {
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
            aria-label={LOCALE_NATIVE_LABEL[l]}
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

/** Globe dropdown for a longer list of languages (5+). */
function LangMenu() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Close on outside click / Escape; move focus back to the trigger on Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("[data-lang-trigger]")?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // On open, focus the active language so keyboard users start on their choice.
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, LOCALES.indexOf(locale));
    optionRefs.current[i]?.focus();
  }, [open, locale]);

  function choose(l: Locale) {
    setLocale(l);
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>("[data-lang-trigger]")?.focus();
  }

  // Roving focus through the options with the arrow keys.
  function onOptionKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next = (index + dir + LOCALES.length) % LOCALES.length;
      optionRefs.current[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      optionRefs.current[LOCALES.length - 1]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        data-lang-trigger
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Language: ${LOCALE_NATIVE_LABEL[locale]}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-surface px-2.5 text-ink transition-colors hover:bg-tint"
      >
        <GlobeIcon />
        <span className="font-display text-[13px] font-extrabold">{LOCALE_LABEL[locale]}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label="Choose language"
          className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] min-w-[11rem] overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {LOCALES.map((l, i) => {
            const active = l === locale;
            return (
              <li key={l} role="none">
                <button
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  onClick={() => choose(l)}
                  onKeyDown={(e) => onOptionKeyDown(e, i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-[9px] px-3 py-2 text-left transition-colors ${
                    active ? "bg-tint text-ink" : "text-slate hover:bg-tint hover:text-ink"
                  }`}
                >
                  <span className="font-display text-[14px] font-bold">{LOCALE_NATIVE_LABEL[l]}</span>
                  <span className="text-[11px] font-extrabold tabular-nums text-slate">
                    {active ? <CheckIcon /> : LOCALE_LABEL[l]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      className={`text-slate transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className="text-primary">
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
