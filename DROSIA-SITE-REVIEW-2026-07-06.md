# Drosia — Site Review & Best-Practice Benchmark

**Date:** 2026-07-06 · **Scope:** live app `https://drosia.vercel.app` + source (`C:\Users\salva\projects\Drosia`) · **Reviewer:** Claude (Cowork)
**Method:** page-content pull of every public route, full source read (components, i18n, design tokens, config, security headers), design-handoff mockups, and a best-practice/competitor benchmark. Confidence markers: High / Moderate / Low.
**Deliverable note:** the highest-value, low-risk fixes were implemented in this session (see §7). Nothing was deployed.

---

## 1. Verdict

Drosia is **well above the average "report litter" app** in engineering quality and design coherence. The report flow, security posture, privacy-by-design architecture and the "Morning Freshness" visual system are genuinely strong — the predecessor's fake-data and schema-drift problems are gone; the landing runs on real aggregates. (Confidence: High)

It is **not yet "best practice in all areas."** The gaps are not conceptual — they are executional and concentrated in five places: (1) **legal/trust pages were missing and the footer that pointed to them was dead text**, (2) **SEO fundamentals were absent** (no robots, no sitemap, wrong `<html lang>`, English-only metadata), (3) **one core colour fails accessibility contrast**, (4) **fonts are loaded in a way that hurts performance and EU data-protection**, and (5) **the retention loop (follow/push) and duplicate-detection are incomplete**. Items 1–3 are fixed in this session; 4–5 are scoped below.

Leading with the hardest truth: **the missing Impressum/Datenschutz was the most damaging issue on the site.** You are courting municipalities and press — the exact audience that checks for a legal notice — and the footer advertised "Privacy · Legal notice · Terms" as plain, unclickable text with no pages behind it. That reads as unfinished or untrustworthy to precisely the people you need. (Confidence: High)

---

## 2. What is already strong (do not regress these)

- **Report flow (`ReportFlow.tsx`).** Four gated steps, sticky CTA that stays tappable to reveal a validation hint only after a tap, EXIF-GPS → live-GPS → manual-pin fallback, in-browser compression (HEIC→JPEG, Vercel 4.5 MB guard), honeypot, cookieless funnel events, and real ARIA (`aria-pressed`, `aria-disabled`, labelled controls). This is better than most commercial civic apps. (High)
- **Privacy-by-design & security.** CSP with per-request nonce (`middleware.ts`), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, tight `Permissions-Policy`, cookieless analytics, anonymous device token, no accounts. (High)
- **Real data, honest guardrails.** Landing uses live aggregates; leaderboard only lists authorities with n ≥ 10 delivered reports, resolution = resolved/notified, with a dispute path and a visible disclaimer. (High)
- **Design system.** Distinct, non-generic aqua palette, a meaningful severity colour scale (fresh→stale), Nunito/Mulish type with tabular numbers. Coherent light/dark. (High)
- **i18n discipline.** EL/EN/DE dictionaries with a key-parity test. (High)

---

## 3. Findings & recommendations (prioritised)

### P0 — Legal / trust  · Confidence: High · **Fixed this session**
The footer in `LandingScreen.tsx` and `TrackingScreen.tsx` rendered `Privacy · Legal notice · Terms` as **plain text, not links**, and **no `/privacy`, `/imprint` or `/terms` routes existed.** For an EU civic app that emails public authorities, a missing Impressum and Datenschutzerklärung is both a legal exposure and a credibility problem — and your own build briefing lists them as P0.
**Done:** created `/privacy`, `/imprint`, `/terms` (trilingual, driven by the i18n dictionary), a shared `LegalScreen`, and wired both footers as real links. The privacy/terms text is an accurate description of the app's actual data flows; **operator identity and a legal review are still required** (placeholders are marked and a review banner is shown). See §7.

### P1 — SEO fundamentals · Confidence: High · **Fixed this session**
- **No `robots.txt`, no `sitemap.xml`.** Crawlers had no guidance and no route inventory. **Done:** `app/robots.ts` (+ disallow `/admin`, `/api`, `/me`) and `app/sitemap.ts`.
- **`<html lang="el">` was hard-coded** while the server renders content per `Accept-Language`. An English visitor received an English page tagged as Greek — wrong for search engines and screen readers. **Done:** root layout now sets `lang` to the detected locale.
- **Metadata was English-only, static, with no `metadataBase` or canonical.** **Done:** `generateMetadata()` now emits per-request localised title/description, `metadataBase`, canonical, and Open Graph locale.
- **Remaining (recommend, Moderate):** i18n is client-side on a single URL, so Google indexes one language and there is no `hreflang`. Acceptable for MVP; for organic reach in three languages, move to per-locale path routing (`/el`, `/en`, `/de`) later.

### P1 — Accessibility · Confidence: High · **Partly fixed this session**
- **`--muted` (#9db1b5) ≈ 2.2:1 on white — fails WCAG AA** (needs 4.5:1), and it is used for real caption text: footer, validation hints, photo counts, partner note. **Done:** darkened to ~4.5:1 in light and dark.
- **No visible keyboard-focus style** on the custom buttons/links (they set backgrounds, not focus rings). **Done:** global `:focus-visible` outline (zero-specificity, so components can override).
- **Remaining (Low):** the "Remove photo" `aria-label` is hard-coded English — localise it. Otherwise interactive controls are labelled.

### P1 — Performance & EU data-protection (fonts) · Confidence: Moderate · **Recommended, not done**
Google Fonts are loaded via a render-blocking `<link>` to `fonts.googleapis.com`. Two problems: it blocks first paint (hurts LCP), and for an EU audience it transmits visitor IPs to Google — German courts have ruled embedding Google Fonts via their CDN a GDPR violation. Your own code comment says "self-host for production/EU."
**Recommend:** migrate to `next/font` (self-hosted, zero layout shift, no third-party request). Verify the Greek subset is included. Medium effort; left out of this session because it needs a visual check.

### P2 — UX gaps vs best practice · Confidence: Moderate
- **No duplicate/nearby check at submit time.** 311 and FixMyStreet surface likely-duplicate reports *before* you submit. Drosia only shows "nearby open" on the tracking page, after the fact — so the same rubbish pile gets reported many times. Add a "these nearby reports might be the same" step between location and category.
- **The follow/push loop is broken by design.** The success screen deliberately omits the follow CTA because no Web-Push sender exists yet. That means the whole device-token + push retention story never pays off. Ship the VAPID sender and re-add the CTA — this is the difference between one-shot reporters and returning users.
- **Desktop is an afterthought.** The app is a 420px phone column centred in empty space. Defensible mobile-first, but on a laptop it looks unfinished and wastes the map. A desktop map-forward layout is a later win. (Low / subjective)

### P2 — Copy · Confidence: High
Copy is a strength: concise, benefit-led, the severity/"clock" framing is excellent. Minor: "Report / dispute" overloads one control with two meanings; consider "Report a problem with this post."

---

## 4. Competitor benchmark — what they do better, where Drosia leads

| Product | Model | Does better than Drosia | Drosia already leads on |
|---|---|---|---|
| **FixMyStreet** (UK, mySociety) | Sends to authority without opt-in — same model | 18 years of trust; **shows nearby existing reports before you submit** (dedup) | Environmental focus, anonymisation, public accountability index, viral share card |
| **SeeClickFix / CivicPlus** (US) | B2G, municipality pays | Mature status lifecycle + acknowledgement; multi-channel (web/app/phone) | Free to citizens; works without the municipality being a customer |
| **Litterati** (US) | Individual-item + cleanups | AI photo tagging; large open dataset | Authority delivery + accountability, not just data collection |
| **TrashOut** (SK) | Global illegal-dump map | Scale (42k+ dumps, 100+ countries) | Automatic authority routing + accountability (TrashOut has neither) |
| **Novoville** (GR/UK/CY) | B2G civic app | 80+ municipalities live | No account required; public accountability layer |

**Net (Moderate-High):** the concept — FixMyStreet's delivery + SeeClickFix's voting + TrashOut's eco-focus + an accountability layer nobody else has — is genuinely differentiated. The best-practice gaps are executional, not strategic: **pre-submit deduplication, legal pages, SEO, contrast, and fonts.** The one feature a direct competitor does that you should copy is FixMyStreet's *nearby-report suggestion at submit time*.

Best-practice civic-UX checklist (311/FixMyStreet norms): category + photo + location ✓ · auto-routing ✓ · real-time tracking ✓ · multilingual ✓ (SSR-lang bug now fixed) · accessibility ⚠→improved · **duplicate detection ✗ (recommend)**.

---

## 5. Prioritised action list

1. **Fill operator identity in the legal pages and get a legal review, then deploy.** (P0)
2. **Self-host fonts via `next/font`.** Performance + GDPR. (P1)
3. **Add a pre-submit nearby/duplicate step.** (P1)
4. **Ship the Web-Push sender and re-enable the follow CTA.** Retention. (P1)
5. Per-locale URL routing (`/el /en /de`) + `hreflang`. (P2)
6. Desktop layout treatment; localise the "Remove photo" label. (P2)

---

## 6. Verification status

Correctness was verified by reading the authoritative source files and by type/structure reasoning: the appended JSON is valid and the EL/EN/DE key sets are identical (so the i18n parity test holds); the edited JSX is balanced; the new metadata/robots/sitemap types are sound. **The in-sandbox `typecheck`/`lint`/`test` gates could not be executed** — the sandbox's working copy lagged behind the edits (a file-sync limitation, not a code fault). Run `npm run typecheck && npm run lint && npm run test` locally before deploy; your CI (`.github/workflows/ci.yml`) runs the same gates on commit.

---

## 7. Changes made in this session

**New files**
- `lib/site-url.ts` — canonical absolute origin for metadata/robots/sitemap.
- `app/robots.ts`, `app/sitemap.ts` — SEO.
- `components/screens/LegalScreen.tsx` — shared legal page (reads the i18n dictionary).
- `app/(public)/privacy/page.tsx`, `.../imprint/page.tsx`, `.../terms/page.tsx` — the three legal routes.

**Edited files**
- `app/layout.tsx` — per-request localised metadata, `metadataBase`, canonical, Open Graph locale, and correct server-side `<html lang>`.
- `app/globals.css` — `--muted` contrast to WCAG AA (light + dark) and a global `:focus-visible` ring.
- `lib/i18n/{en,el,de}.json` — added `meta` (SEO title/description) and `legal` (privacy/imprint/terms) blocks, in all three languages.
- `components/screens/LandingScreen.tsx`, `components/screens/TrackingScreen.tsx` — footer legal labels are now real links.

**Still required before the legal pages go live:** replace the `[Operator name] / [address] / [email]` placeholders and have the text reviewed legally. The pages show a review banner until then.
