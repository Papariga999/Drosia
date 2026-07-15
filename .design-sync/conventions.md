# Drosia — build conventions

Drosia is a login-free civic app for reporting litter to the responsible
authority. Tone: fresh, optimistic, mobile-first ("Morning Freshness" palette —
aqua on near-white, never Aegean navy). Screens are phone-width columns:
`<div className="max-w-phone">` (420px) centered on `bg-surface`.

## Setup (required)

Wrap every screen in `LocaleProvider` — `LangSwitch` and `BottomNav` read the
locale context and **throw** without it. Dark mode is the `dark` class on a
root element (light is default; tokens flip automatically).

```jsx
import { LocaleProvider, AppBar, BottomNav } from "drosia";

<LocaleProvider initialLocale="en">   {/* "el" | "en" | "de" */}
  <div className="max-w-phone bg-surface text-ink">
    <AppBar showWordmark />
    {/* screen content */}
    <BottomNav />
  </div>
</LocaleProvider>
```

## Styling idiom

Tailwind utility classes over CSS-variable tokens. **The shipped stylesheet is
a fixed subset** (compiled from the app) — a utility not listed below may not
exist. For anything missing, use an inline `style` with the token var — that is
the app's own pattern for dynamic color (`style={{ color: "var(--sev-warn)" }}`).

| Family | Classes that exist |
|---|---|
| Brand | `bg-primary` `text-primary-ink` `bg-success` `text-white` |
| Surfaces | `bg-surface` `bg-surface-card` `bg-tint` `bg-tint-soft` |
| Text | `text-ink` `text-ink-contrast` `text-slate` `text-muted` |
| Borders | `border-line` `border-line-strong` |
| Scrim/hero | `bg-ink` (theme-flips) · `bg-ink-fixed` (constant deep teal) |
| Radius | `rounded-btn` (14px) `rounded-xl` `rounded-2xl` — cards: `style={{borderRadius:"var(--radius-card)"}}` (18px) |
| Shadow | `shadow-card` `shadow-float` `shadow-btn` |
| Type | `font-display` (Nunito, headings/numbers, 700–900) · `font-sans` (Mulish, body) · `tracking-display` · `tnum` on EVERY number |
| Layout | `max-w-phone` |

Tokens without a compiled class — inline `var()` only: `--accent` (citrus
#FFC247), `--surface-raised`, `--sev-fresh/--sev-mild/--sev-warn/--sev-stale`.

Severity is the product's heart: age tints via the fixed scale (fresh < 7d
green, mild < 30d yellow, warn < 60d orange, stale ≥ 60d red). Never invent
severity colours — pass `days` to `SeverityPill`/`SeverityCounter` and they
resolve it; for custom marks use the `--sev-*` vars.

## Where the truth lives

Read `styles.css` → it imports `fonts/fonts.css` and `_ds_bundle.css` (all
compiled utilities + the `:root`/`.dark` token blocks — the authoritative token
list). Per-component API: `components/<group>/<Name>/<Name>.d.ts`; usage:
`<Name>.prompt.md`.

## Composition example

```jsx
import { LocaleProvider, SeverityCounter, SeverityPill, StatusTimeline, Button } from "drosia";

<LocaleProvider initialLocale="en">
  <div className="max-w-phone bg-surface p-4 text-ink">
    <div className="bg-surface-card p-4 shadow-card" style={{ borderRadius: "var(--radius-card)" }}>
      <SeverityPill days={41} label="Ignored 41 days" />
      <SeverityCounter days={41} openForLabel="Open for" daysLabel="days" fixedAfterLabel="Fixed after" />
      <StatusTimeline steps={[
        { label: "Reported", date: "12 Jun", done: true },
        { label: "Forwarded", date: "13 Jun", done: true, current: true },
        { label: "Acknowledged", date: null, done: false },
        { label: "Fixed", date: null, done: false },
      ]} />
      <Button variant="primary">Important — bump it</Button>
    </div>
  </div>
</LocaleProvider>
```
