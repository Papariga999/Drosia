# Drosia

Login-free civic web app: report litter & environmental issues → routed to the responsible authority (PostGIS) → after moderation, an email is auto-sent to that authority **with a link to the report** → public tracking page, map, and an accountability scorecard. **Launch: Greece** (one island region). **Architecture & brand: EU-ready from day one.**

**Authoritative build brief & rules:** [`CLAUDE.md`](./CLAUDE.md).
Brand: `DROSIA-BRAND-KONZEPT-2026-06-23.md` · Design: `BRIEFING-CLAUDE-DESIGN-CleanRebuild-EUready-2026-06-23.md` · Admin board: `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md`.

## Stack
Next.js 16 / React 19 / TypeScript strict · Supabase (Postgres + PostGIS + Storage + RLS) · Resend · sharp · Leaflet · Web Push (VAPID) · Tailwind · Vitest · PWA · Vercel.

## Run it locally (full loop, no domain needed)

You need a Postgres + PostGIS + Storage instance. Easiest is local Supabase via Docker (`supabase start`), or a free Supabase cloud project.

1. **Install:** `npm install`
2. **Env:** `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from your Supabase project / `supabase status`)
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (any strong values) to use the admin board
   - **Leave `RESEND_API_KEY` empty** — delivery then runs in **dev mode** (logs to the server console, no real email, no verified domain required).
3. **Schema:** apply `supabase/schema.sql` (idempotent). Local CLI: `supabase db reset`. Cloud: paste it into the SQL editor. PostGIS is enabled by the script.
4. **Seed (dev only):** `SEED_ENV=dev npm run seed` — activates Greece with a placeholder geofence boundary and two real authorities (Rhodes, Kos) with coverage polygons so routing works.
5. **Start:** `npm run dev` → http://localhost:3000

### Test the end-to-end loop
1. Go to **/report**. Add a photo, set the location (use a point inside Rhodes/Kos, e.g. `36.34, 28.12`, via "Use my current location" or the manual coordinate fields — a point outside Greece is rejected by the geofence). Pick a category, accept consent, send. You get a real tracking token.
2. The report is `submitted` and **not yet public** (its photo is anonymized but it still needs moderation).
3. Open **/admin**, sign in with `ADMIN_PASSWORD`. The report is in the **Moderation Queue**. Open it → **Approve & send**. It becomes `in_review` → delivery runs (dev-mode log) → `notified`.
4. Open **/map** and **/r/&lt;token&gt;** — the report now shows publicly with its anonymized photo, status timeline, and severity counter.

> Without Supabase configured, the public pages fall back to demo data and submitting returns a clear "backend not configured" message — so the UI is still browsable, but the real loop needs the DB.

**Production note:** the dev anonymizer applies a full-image blur (privacy-safe but low-utility) — production must swap in real selective face/plate detection behind `lib/providers/anonymize.ts`. The seed's GR boundary is a placeholder bbox; load the real GeoJSON before launch. The sender domain **drosia.eu** must be verified in Resend (SPF/DKIM/DMARC) before real email — deliverability is a P0 blocker.

## Quality gates (every phase)
- `npm run typecheck` → 0 errors
- `npm run lint` → clean
- `npm run test` → green
- `supabase/schema.sql` applies cleanly to a fresh Postgres + PostGIS

## Non-negotiables (see CLAUDE.md §2)
Login-free & anonymous (device token, no email collection) · **anonymization before any public photo** (faces + plates) · EU-ready (country/authority are data, not constants) · **no test data in production** · leaderboard fairness (n ≥ 10, notified-only — enforced in `v_authority_scorecard`) · RLS everywhere, public reads via views only · **admin board is English-only** (but outgoing authority emails stay in the authority's language).

## Structure
```
app/                 Next.js App Router (public app mobile-first; admin board desktop, English)
lib/
  supabase/          client (anon) + admin (service-role, server-only)
  providers/         geocoding · anonymize · deliver  (swappable interfaces)
  i18n/              el/en/de + parity
  geo.ts             pre-filter + geocode-cache key helpers
  categories.ts      report categories (in sync with the SQL enum)
supabase/schema.sql  single source of truth (idempotent, PostGIS, RLS, fairness views)
scripts/seed.ts      dev-only, SEED_ENV-guarded
tests/               i18n parity · geo
```
Build order: Phase 0 (this scaffold) → 1 core loop → 2 credibility & legal → 3 engagement → 4 EU-readiness. One PR per phase, gates green.
