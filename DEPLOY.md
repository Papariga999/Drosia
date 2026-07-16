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
   | `TRUST_CF_HEADER` | `true` only if actually served behind Cloudflare (otherwise the IP rate-limit key is spoofable) |
   | `ANONYMIZER_PROVIDER` | `http` to use a selective face/plate service (`ANONYMIZER_URL`, `ANONYMIZER_API_KEY`); empty = safe full-blur default |

3. **Deploy.** Future `git push`es to `main` auto-deploy.

> **Worldwide intake:** reports can be submitted from any valid coordinates.
> Active country and authority polygons route covered locations. Unmatched reports
> use the same anonymization/moderation flow and can publish globally, but no
> authority email is attempted until an authority is assigned.

## 4. Verify

Open the URL → submit at `/report` with Greek coordinates (e.g. `36.34, 28.12`, inside Rhodes) →
sign in at `/admin` → **Approve & send** → the report appears on `/map` and `/r/<token>`.

## 5. DDoS & abuse protection (ops)

Defense is layered — know which layer you're looking at before changing anything:

1. **App-level rate limits** (code): every public write endpoint uses a durable per-IP
   limit that **fails closed** in production ([`lib/rate-limit.ts`](lib/rate-limit.ts)).
   Confirmed denials are answered from an in-memory deny cache until the window resets,
   so a sustained flood costs the DB ~one write per window instead of one per request.
   Protects against abuse (spam, brute force, vote inflation), not floods.
2. **Public-read cache** (code): landing/map/urgent/nearby reads go through a 30–60s
   TTL cache ([`lib/ttl-cache.ts`](lib/ttl-cache.ts)), so a page-view flood does not
   fan out into per-request Supabase queries.
3. **Vercel WAF rule** (live in production, stops floods *before* a function is invoked
   or the DB is touched): `Rate limit report submissions` — `POST /api/report`,
   **10 req / 60 s per IP → deny**. Inspect / manage:

   ```bash
   npx vercel firewall rules list --scope salvatores-projects-73e81593
   npx vercel firewall rules inspect "Rate limit report submissions" --scope salvatores-projects-73e81593
   ```

   The Hobby plan allows **one** rate-limit rule; it's spent on `/api/report` (the
   expensive endpoint: uploads, sharp, storage). **On Pro upgrade**, add a second rule
   for the admin login:

   ```bash
   npx vercel firewall rules add "Rate limit admin login" \
     --condition '{"type":"path","op":"eq","value":"/api/admin/login"}' \
     --condition '{"type":"method","op":"eq","value":"POST"}' \
     --action rate_limit --rate-limit-window 60 --rate-limit-requests 20 \
     --rate-limit-keys ip --rate-limit-action deny --yes
   # then: npx vercel firewall publish --yes
   ```

4. **Break-glass — Attack Challenge Mode** (use during an active L7 flood; challenges
   every visitor with a verification page, takes effect immediately, no publish step):

   ```bash
   npx vercel firewall attack-mode enable --scope salvatores-projects-73e81593   # during attack
   npx vercel firewall attack-mode disable --scope salvatores-projects-73e81593  # after
   ```

   Browser visitors pass the challenge and can keep reporting; plain API clients are
   blocked while enabled. Never leave it on outside an incident.
5. **Spend**: on the current **Hobby** plan there is no pay-per-use billing — the
   platform pauses the site at the free-tier caps, so "denial of wallet" cannot happen.
   **Immediately after any Pro upgrade**: Vercel dashboard → team **Settings →
   Billing → Spend Management** → set a monthly budget, enable the pause-at-budget
   action, and add an email/webhook alert. Do this in the same sitting as the upgrade.

**Incident quick-path**: unexplained traffic/cost spike → check the Firewall tab in the
Vercel dashboard (observability of blocked vs. served) → enable attack mode (above) →
watch Supabase load in its dashboard → disable when traffic normalizes.

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
