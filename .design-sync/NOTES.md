# design-sync notes — Drosia

- Drosia is a Next.js **app**, not a packaged design system: there is no dist/
  build and no `.d.ts` tree. The converter runs in synth-entry mode over
  `components/` source; scope is deliberately UI + brand only (user decision
  2026-07-15) — screens/, maps/, admin/, TrackPageView are excluded via
  `componentSrcMap` nulls (they need app context: routing, APIs, Leaflet).
- Styling is Tailwind v3 utilities over CSS-variable tokens defined in
  `app/globals.css` ("Morning Freshness" palette; dark mode = `.dark` class on
  the root). There is no shipped stylesheet — `cfg.buildCmd` compiles one with
  the Tailwind CLI into `.design-sync/.cache/tailwind.css` (gitignored;
  re-run buildCmd before every converter run).
- Fonts: the app self-hosts Nunito + Mulish via `next/font/google`, which
  injects `--font-display`/`--font-sans` on `<html>` at runtime — no static
  @font-face exists in source. `.design-sync/fonts/drosia-fonts.css` (committed,
  woff2 files harvested from `.next/static/media` on 2026-07-15) recreates the
  @font-face rules and defines the two font vars at `:root`. If font weights or
  subsets change in `app/layout.tsx`, re-harvest from a fresh `.next` build.
- Components needing context: `LangSwitch` and `BottomNav` call `useLocale()` —
  `cfg.provider` wraps previews in `LocaleProvider` (exported into the bundle
  via `extraEntries`, not as a card) with `initialLocale: "en"` so cards read
  in English (app default is `el`).
- `BottomNav` uses `next/navigation` `usePathname`; `Button`/`ButtonLink`,
  `AppBar`, `BottomNav` use `next/link`. Outside a Next runtime these may throw
  ("expected app router to be mounted") — if so, the fix tried first should be
  tsconfig `paths` aliases to small local stubs (documented knob) rather than
  lib forks.
- `VoteBar` touches `localStorage` via `lib/device-token` at click-time only;
  static render is fine.
- `PhotoPlaceholder` accepts NO `style` prop (only className/pixel/src/children)
  — size it via a wrapper div or compiled classes (`h-full w-full` exist).
- The compiled stylesheet is a fixed subset of Tailwind (only app-used
  utilities). Missing-but-token-backed: `bg-accent`, `bg-surface-raised`,
  `rounded-card`, `bg-severity-*` — conventions.md teaches the inline
  `var(--*)` fallback instead. Re-validate conventions.md's class table if the
  app's utility usage shifts.

## Known render warns

- `[RENDER_THIN] DrosiaMark` — benign: the authored preview is SVG-only (no
  text nodes), which the text/paint probe can't measure; the review sheet
  shows all drops painted correctly.
- `[TOKENS_MISSING] --tw-shadow-color, --pin-color` (when it appears; "2
  missing, below threshold" in later runs) — runtime-set vars: `--tw-*` is
  Tailwind's own shadow plumbing, `--pin-color` is set inline by map pin code
  (DrosiaMap, out of scope).

## Re-sync risks

- **Fonts can silently drift**: `.design-sync/fonts/` was harvested from
  `.next/static/media` on 2026-07-15. If `app/layout.tsx` changes families,
  weights, or subsets, re-harvest (build the app, copy the woff2s, regenerate
  drosia-fonts.css) — nothing will warn automatically.
- **Compiled CSS is generated per-run**: `buildCmd` must run before every
  converter build (`.design-sync/.cache/` is gitignored); a stale or missing
  tailwind.css ships stale utilities without failing.
- **Locale dictionaries are bundled**: `LocaleProvider` pulls
  `lib/i18n/*.json` into the bundle — copy changes in the app change preview
  labels (BottomNav/LangSwitch) and re-verify those components.
- **next/link & next/navigation are stubbed** (`.design-sync/stubs/`,
  wired via `.design-sync/tsconfig.design.json` paths): if components start
  using more of the next API (useRouter methods, Link callbacks), extend the
  stubs or previews will throw.
- **Chrome, not bundled chromium**: render checks/captures run with
  `DS_CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`
  (playwright installed in .ds-sync without browser download). A machine
  without Chrome needs `npx playwright install chromium` instead.
- Verified only in **light mode**; dark-mode rendering of cards was not
  machine-checked (tokens flip via the `.dark` class and are shipped, but no
  screenshot pass ran against them).
