# Deploying Drosia

A live deployment = the **Next.js app on Vercel** + a **Supabase project** (Postgres + PostGIS + Storage)
behind it. Both run on free tiers. ~30 minutes. The app does nothing useful without the database.

## 1. Supabase (backend)

1. Create a project at [supabase.com](https://supabase.com) (a region near your users, e.g. Frankfurt).
2. **SQL Editor → New query →** paste all of [`supabase/schema.sql`](supabase/schema.sql) and run it.
   It is idempotent and sets up PostGIS, tables, views, RPCs, RLS, and the two storage buckets.
   - If you see a NOTICE about skipped bucket creation, go to **Storage** and create them by hand:
     `report-originals` (Public **off**) and `report-public` (Public **on**).
3. **Settings → API** — copy: **Project URL**, **anon public** key, **service_role** key.

## 2. Seed Greece + authorities (one-time)

Locally, with `.env.local` filled in (copy from [`.env.example`](.env.example)) and pointing at the
project above:

```bash
npm install
npm run seed          # requires SEED_ENV=dev in .env.local
```

Activates Greece (placeholder geofence boundary) and the Rhodes/Kos authorities so routing works.

## 3. Vercel (app)

1. [vercel.com](https://vercel.com) → **Add New → Project → Import** this GitHub repo. Next.js is auto-detected.
2. Add **Environment Variables** (see `.env.example` for the full list):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server-only) |
   | `ADMIN_PASSWORD` | **a real password** — `/admin` is public |
   | `ADMIN_SESSION_SECRET` | a long random string (`openssl rand -hex 32`). **Required in production** — the app refuses to sign admin sessions without it. Rotating it (or `ADMIN_PASSWORD`) logs everyone out. |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL (set after first deploy, then redeploy) |
   | `RESEND_API_KEY` | leave **empty** for dev-mode delivery (logs, no real email) |
   | `RESEND_WEBHOOK_SECRET` | optional: Svix signing secret for the bounce/complaint webhook (`/api/webhooks/resend`); falls back to Bearer `WEBHOOK_SECRET` |
   | `GEOFENCE_RELAXED` | `true` **only for cross-country testing** (e.g. submitting from Germany). Leave unset for launch → reports outside an active country are rejected. |
   | `TRUST_CF_HEADER` | `true` only if actually served behind Cloudflare (otherwise the IP rate-limit key is spoofable) |
   | `ANONYMIZER_PROVIDER` | `http` to use a selective face/plate service (`ANONYMIZER_URL`, `ANONYMIZER_API_KEY`); empty = safe full-blur default |

3. **Deploy.** Future `git push`es to `main` auto-deploy.

> **Testing from outside Greece:** the geofence is strict by default and the app
> enforces it in code, so a report submitted from e.g. Germany is rejected. To keep
> testing during development, set `GEOFENCE_RELAXED=true` (Preview and/or Production
> scope). **Remove it before launch** — no code change needed, the geofence becomes
> strict again automatically.

## 4. Verify

Open the URL → submit at `/report` with Greek coordinates (e.g. `36.34, 28.12`, inside Rhodes) →
sign in at `/admin` → **Approve & send** → the report appears on `/map` and `/r/<token>`.

## Known placeholders (replace before a real launch)

- **Anonymizer** ([`lib/providers/anonymize.ts`](lib/providers/anonymize.ts)) defaults to a full-image
  blur — privacy-safe but low-utility. A production seam exists: set `ANONYMIZER_PROVIDER=http` +
  `ANONYMIZER_URL`/`ANONYMIZER_API_KEY` to plug in a selective face/plate service (fails closed).
- **Bounce/complaint feedback**: add a Resend webhook → `https://<your-domain>/api/webhooks/resend`
  (events `email.delivered`, `email.bounced`, `email.complained`) so delivery status is tracked.
- **Geofence boundary** is a coarse GR bounding box (in [`scripts/seed.ts`](scripts/seed.ts)). Load the
  real GR MultiPolygon GeoJSON.
- **Email** is dev-mode (logged, not sent). For real delivery, verify a domain in Resend
  (SPF/DKIM/DMARC), set `RESEND_API_KEY` (a `re_…` key), `EMAIL_FROM`, and `EMAIL_VERIFIED_DOMAIN`.

## Gates (CI runs these on every push)

```bash
npm run typecheck && npm run lint && npm run test
```
