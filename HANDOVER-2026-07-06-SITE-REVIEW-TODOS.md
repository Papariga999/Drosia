# Handover → Claude Code: remaining to-dos after the 2026-07-06 site review

**Read first:** `CLAUDE.md` (non-negotiable principles + deny patterns) and `DROSIA-SITE-REVIEW-2026-07-06.md` (the review this handover follows from).
**Your job:** finish the work orders below in order. Each is self-contained: goal, why, files, steps, acceptance. Respect the guardrails in §0. Commit per work order with a green `typecheck + lint + test`.

---

## 0. Guardrails (do not violate)

- **Additive migrations only.** `supabase/schema.sql` is the single source of truth, idempotent (`create table if not exists`, `add column if not exists`). Never `drop table`. Every new table gets `enable row level security` and is added to `baseTables` in `tests/schema-guardrails.test.ts`.
- **No secrets in the repo.** VAPID/private keys go in env only. `.env.example` documents them; `.env.local` is git-ignored.
- **Fail safe.** New senders/integrations must no-op (not crash) when unconfigured — mirror `lib/push/send.ts`.
- **Login-free & anonymous.** No accounts, no email capture, no fingerprinting. Identity = anonymous device token.
- **Every `.from("table")` must exist in `schema.sql`** (the drift guardrail test enforces this).
- Gates for every work order: `npm run typecheck` → 0, `npm run lint` → clean, `npm run test` → green, and `npm run build` for anything touching routes/metadata.

---

## 1. What was already done in the 2026-07-06 session (starting state)

Do **not** redo these. Verify they're green first (§WO-0).

**SEO** — added `app/robots.ts`, `app/sitemap.ts`, `lib/site-url.ts`; `app/layout.tsx` now emits per-request localised metadata (`generateMetadata`), `metadataBase`, canonical, OG locale, and a correct server-side `<html lang>`.
**Accessibility** — `app/globals.css`: `--muted` darkened to WCAG-AA contrast (light + dark) and a global `:focus-visible` ring.
**Legal** — new `/privacy`, `/imprint`, `/terms` routes (`app/(public)/*/page.tsx`) rendering `components/screens/LegalScreen.tsx` from the i18n `legal` block; footers in `LandingScreen.tsx` and `TrackingScreen.tsx` are now real links. Content is an accurate draft with **placeholder operator identity** (see WO-3).
**Web-Push (code-complete, needs activation)** — `report_follows` table in `schema.sql`; `lib/push/send.ts` (VAPID sender, fail-safe, prunes dead subs); `public/sw.js` (service worker); `lib/push/client.ts` (`followReport`/`canFollow`); `/api/push/subscribe` accepts a `reportToken` and records a follow; `lib/admin/deliver-report.ts` pushes followers on the `→ notified` transition; follow CTA re-enabled on the success screen and wired on the tracking screen; `push` i18n block added to en/el/de.

> ⚠️ The review session could not run the gates in its sandbox (a file-sync limitation). **Treat WO-0 as mandatory.**

---

## WO-0 — Verify the session's changes (do this first)

**Steps**
1. `npm run typecheck && npm run lint && npm run test && npm run build`.
2. Fix any fallout. Likely-clean, but check specifically: i18n parity (`meta`, `legal`, `push` keys exist in en/el/de), the `report_follows` guardrail (`tests/schema-guardrails.test.ts` now lists it), and that `app/layout.tsx` `generateMetadata` compiles under Next 16.
**Acceptance:** all four commands pass. Commit as `chore: verify site-review fixes`.

---

## WO-1 — Activate Web-Push (VAPID + migration) and add the `resolved` trigger

**Why:** the code is wired but push is inert until keys + schema exist, and only the `→ notified` event notifies followers today. The `→ resolved` event (the most satisfying update) has **no trigger** because no admin route sets `status='resolved'` yet.

**Steps**
1. **Generate keys:** `npx web-push generate-vapid-keys`. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `.env.local` and in Vercel (Production + Preview). These already exist in `.env.example`.
2. **Apply the migration:** run the updated `supabase/schema.sql` against the Supabase project (adds `report_follows`). Confirm RLS is enabled and no anon policy exists.
3. **Add the `resolved` push.** Find/confirm where a report is set to `resolved` (there is currently **no** admin route doing this — likely add it to a resolve action or `app/api/admin/reports/update`/`visibility`). Wherever the transition to `resolved` happens, after the DB update call:
   ```ts
   const dict = getDict(isLocale(report.locale) ? report.locale : DEFAULT_LOCALE);
   await notifyReportFollowers(report.id, {
     title: dict.push.resolvedTitle,
     body: dict.push.resolvedBody,
     url: `${SITE_URL}/r/${report.public_token}`,
   });
   ```
   Add `push.resolvedTitle` / `push.resolvedBody` to **all three** i18n files (keep parity).
4. **CSP is already fine** — `middleware.ts` has `worker-src 'self' blob:` and `connect-src 'self' https:`. No change needed.

**Acceptance / manual test**
- On an iOS/Android/desktop browser: submit a report → tap **Follow** on the success screen → grant permission (a `push_subscriptions` row + a `report_follows` row appear).
- Approve+notify that report in the admin board → the followed device receives a "Forwarded to the authority" notification; tapping it opens `/r/<token>`.
- Mark it resolved → a "Resolved" notification arrives.
- Unconfigured (no VAPID keys) → the app still runs; `notifyReportFollowers` no-ops. Add a Vitest that asserts the sender returns without throwing when keys are unset.

---

## WO-2 — Self-host fonts via `next/font` (performance + EU/GDPR)

**Why:** fonts load via a render-blocking `<link>` to `fonts.googleapis.com`, which hurts LCP and transmits visitor IPs to Google (a GDPR problem in the EU; the code comment already says "self-host for production/EU"). `middleware.ts` CSP currently allows `fonts.googleapis.com` / `fonts.gstatic.com` specifically to accommodate this — tighten it after.

**Steps**
1. Replace the `<link>` fonts in `app/layout.tsx` with `next/font/google` (`Nunito`, `Mulish`), exposing them as CSS variables `--font-display` / `--font-sans` (already referenced in `globals.css` and `tailwind.config.ts`). **Include the `greek` subset** — the app is EL-first.
2. Remove the `<link rel="preconnect">` + stylesheet `<link>`.
3. Tighten `middleware.ts` CSP: drop `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src` (now self-hosted).
**Acceptance:** Greek, Latin and German glyphs render correctly; no request to `fonts.googleapis.com`/`gstatic.com` in the network panel; Lighthouse LCP improves; gates green.

---

## WO-3 — Complete the legal pages

**Why:** the pages exist but carry placeholder operator identity; an EU civic app that emails authorities needs a real Impressum + Datenschutz.

**Steps**
1. In `lib/i18n/{en,el,de}.json` → `legal.*.sections`, replace the `[Operator name] / [address] / [email] / VAT / represented-by` placeholders with real details (all three languages).
2. Have the privacy/terms text reviewed by a lawyer for GR/EU (DSA notice-and-takedown is already implemented via `content_flags`; the Art. 30 record should live as a repo doc).
3. Remove the `legal.reviewNote` banner string usage once done (or blank the key in all three).
**Acceptance:** no bracketed placeholders remain; `/privacy`, `/imprint`, `/terms` render correctly in EL/EN/DE; footer links work from landing + tracking.

---

## WO-4 — Pre-submit duplicate / nearby-report check

**Why:** the one feature a direct competitor (FixMyStreet) does that Drosia doesn't — it stops the same rubbish pile being reported many times. Today "nearby open" only shows on the tracking page, after submission.

**Steps**
1. Add a step (or an inline card) between **location** and **category** in `components/screens/ReportFlow.tsx`: after coords are set, query public reports within ~50–100 m (reuse the map/`v_public_reports` data or add a small `/api/reports/nearby?lat=&lng=` route backed by a PostGIS `ST_DWithin` query — define any new function/view in `schema.sql`).
2. Show up to 3 nearby open reports with a thumbnail + age and two actions: **"It's the same — follow it"** (calls `followReport(token)` and routes to `/r/<token>`) and **"No, this is new — continue"**.
3. Keep it non-blocking (skippable) and cookieless.
**Acceptance:** reporting on top of an existing pin surfaces it and lets the user follow instead of duplicating; new locations pass straight through; gates green including a test for the nearby query.

---

## WO-5 — SEO: per-locale URLs + `hreflang` (bigger, optional)

**Why:** i18n is client-side on a single URL, so Google indexes one language and there's no `hreflang`. Caps organic reach across EL/EN/DE.

**Steps (design first, then implement):** introduce locale-prefixed routes (`/el`, `/en`, `/de`) or `Accept-Language`-based `rewrites`, emit `alternates.languages` (hreflang) in metadata, and update `sitemap.ts` with per-locale entries. Keep the existing client `LocaleProvider` for the in-app switch. This touches routing broadly — do it as its own branch with careful review.
**Acceptance:** each language has a crawlable URL with correct `<html lang>` and reciprocal `hreflang`; sitemap lists all locale variants.

---

## WO-6 — Small polish

- **Localise the "Remove photo" `aria-label`** in `ReportFlow.tsx` (currently hard-coded English) — add a key to all three dictionaries.
- **Desktop layout:** the app is a 420px phone column centred in empty space. Consider a desktop-only map-forward layout for `/` and `/map` (progressive enhancement; don't regress mobile).
- **Guard the tracking Follow button** with `canFollow()` so it hides on unsupported browsers (the success screen already does this).

---

## Reference — files touched on 2026-07-06

New: `lib/site-url.ts`, `app/robots.ts`, `app/sitemap.ts`, `components/screens/LegalScreen.tsx`, `app/(public)/{privacy,imprint,terms}/page.tsx`, `lib/push/send.ts`, `lib/push/client.ts`, `public/sw.js`.
Edited: `app/layout.tsx`, `app/globals.css`, `lib/i18n/{en,el,de}.json` (`meta`, `legal`, `push`), `components/screens/{LandingScreen,TrackingScreen,ReportFlow}.tsx`, `app/api/push/subscribe/route.ts`, `lib/admin/deliver-report.ts`, `supabase/schema.sql` (`report_follows`), `tests/schema-guardrails.test.ts`.
