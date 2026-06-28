# Übergabe — Security- & QA-Härtung (Session 2026-06-28)

> Für das lokale Claude Code. Diese Datei dokumentiert, **was in dieser Session
> umgesetzt wurde**, **was noch zu tun ist** (Deploy-seitig) und **welche Punkte
> bewusst offen blieben**. Quelle der Wahrheit für DB bleibt `supabase/schema.sql`.

## Kontext

Ausgangspunkt war ein Security-/QA-Review der Live-App (drosia.vercel.app) gegen
die nicht-verhandelbaren Prinzipien in `CLAUDE.md`. Daraus wurden Findings in
P0/P1/P2 priorisiert und umgesetzt.

- **Branch:** `claude/project-security-review-v198uc`
- **PR:** #1 (Draft) → https://github.com/Papariga999/Drosia/pull/1
- **CI:** grün (typecheck/lint/test, 51 Tests). Vercel-Preview deployed.
- **Noch nicht gemergt.** Live (`main`) läuft weiter den alten Stand.

---

## Was umgesetzt wurde

### P0 — Launch-Blocker
1. **Admin-Session-Secret ohne unsicheren Default** — `lib/admin/session.ts`
   `secret()` wirft in Produktion, wenn weder `ADMIN_SESSION_SECRET` noch
   `WEBHOOK_SECRET` gesetzt ist (vorher Fallback `"dev-insecure-secret"` →
   fälschbare Admin-Cookies).
2. **Zentrales Admin-Gate** — `middleware.ts` (neu)
   Edge-safe (Web Crypto) Verifikation aller `/api/admin/*` außer `login`.
   Defense-in-depth zusätzlich zu `verifySession()` in jeder Route.
3. **Strikter Geofence (default)** — `app/api/report/route.ts`, `supabase/schema.sql`
   `intake_report` wirft `OUT_OF_BOUNDS`; Route → HTTP 422 + In-Code-Enforcement
   (belt-and-suspenders, greift auch ohne DB-Migration). Test-Modus via
   `GEOFENCE_RELAXED=true`.
4. **Durables Rate-Limiting** — `lib/rate-limit.ts`, `supabase/schema.sql`
   `rate_limits`-Tabelle + `rate_limit_hit`-RPC, genutzt von admin-login / report /
   flag über `rateLimitDurable()`. Fällt auf In-Memory zurück, wenn DB/RPC fehlt.
5. **`clientIp` Anti-Spoofing** — `lib/rate-limit.ts`
   Kein blindes Vertrauen in `cf-connecting-ip`/`x-forwarded-for`; bevorzugt den
   Vercel-Header. `cf-connecting-ip` nur bei `TRUST_CF_HEADER=true`.

### P1 — Wichtig
6. **Selektiver Anonymizer-Seam** — `lib/providers/anonymize.ts`
   `HttpAnonymizer` (`ANONYMIZER_PROVIDER=http`) postet das Original an einen
   Gesichts-/Kennzeichen-Dienst; **fail-closed**. DevBlur (Full-Blur) bleibt
   sicherer Default.
7. **Security-Header / CSP** — `next.config.mjs`
   CSP (`frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options: DENY`,
   `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS (prod).
8. **DSA-Takedown Storage-Löschung** — `lib/admin/takedown.ts` (neu)
   Bei Reject / Flag-Remove wird das anonymisierte Foto aus dem Public-Bucket
   gelöscht und `public_path` genullt. Eingebunden in
   `app/api/admin/reports/reject/route.ts` und `app/api/admin/flags/action/route.ts`.
9. **Resend Bounce/Complaint-Webhook** — `app/api/webhooks/resend/route.ts` (neu)
   Mappt `email.delivered/bounced/complained` auf `delivery_logs`
   (per `provider_message_id`). Auth: Svix-Signatur (manuell, ohne Extra-Dep)
   oder Bearer `WEBHOOK_SECRET`.
10. **Session an Passwort gebunden** — `lib/admin/session.ts`, `middleware.ts`
    Passwort-Fingerprint im Cookie signiert → `ADMIN_PASSWORD` rotieren widerruft
    alle Sessions. Cookie-Format ist jetzt 3-teilig (`issued.fp.mac`).

### P2 — Follow-ups
11. **Phase-3 Engagement verdrahtet**
    - `app/api/vote/route.ts` (neu): 👍 priority / 🔴 still_here, Dedup pro Gerät
      pro Typ via UNIQUE, IP-Rate-Limit, Honeypot, nur veröffentlichte Reports.
      `components/ui/VoteBar.tsx` postet jetzt echt (Device-Token) und synct
      Counts; `TrackingScreen.tsx` reicht `token` durch.
    - `app/api/push/subscribe/route.ts` (neu): speichert Web-Push-Subscription
      (Upsert auf endpoint), login-frei.
12. **Authority-E-Mail-Validierung** — `app/api/admin/authorities/route.ts`
    Ungültige Adresse → 400 (POST + PATCH).
15. **Nicht-blockierende Anonymisierung** — `app/api/report/route.ts`
    Läuft via `after()` nach dem Response (kein Submit-Timeout bei 3 Fotos).
16. **Negative Guardrail-Tests** — `tests/schema-guardrails.test.ts`
    RLS auf allen Basistabellen, Anon-Reads nur auf `v_`-Views, RPCs für anon
    gesperrt, strikter Geofence-Raise, Vote-Dedup.

### Tests (neu)
- `tests/rate-limit.test.ts` — Limiter-Fenster + `clientIp`-Anti-Spoofing.
- `tests/admin-session.test.ts` — Revoke-on-Rotate, Tamper, Malformed.

### Neue Env-Variablen (in `.env.example` dokumentiert)
`GEOFENCE_RELAXED`, `TRUST_CF_HEADER`, `RESEND_WEBHOOK_SECRET`,
`ANONYMIZER_PROVIDER`, `ANONYMIZER_URL`, `ANONYMIZER_API_KEY`.
`ADMIN_SESSION_SECRET` ist jetzt **Pflicht in Prod**.

---

## Was noch zu tun ist (Deploy-/Betrieb)

> Code degradiert sicher, aber diese Schritte fehlen für volle Wirkung in Prod.
> Konnte in dieser Session nicht erledigt werden, weil die Supabase-MCP-Aufrufe
> eine Freigabe brauchten, die nicht durchkam.

1. **DB-Migration anwenden** (Supabase SQL-Editor, Projekt `qlzwhymcseveqvflxzbz`).
   Entweder das komplette `supabase/schema.sql` neu ausführen (idempotent), **oder**
   nur die Delta-Teile. **Achtung Wunsch des Users:** Geofence soll vorerst
   **relaxed** bleiben, um aus Deutschland zu testen → **nur den Rate-Limiting-Teil
   anwenden** (`rate_limits` + `rate_limit_hit`), den strikten `intake_report`-Teil
   (mit `OUT_OF_BOUNDS`-Raise) **weglassen**.
2. **Vercel Env-Vars setzen:**
   - `ADMIN_SESSION_SECRET` (Pflicht; `openssl rand -hex 32`)
   - `GEOFENCE_RELAXED=true` (Testbetrieb; zum Launch entfernen)
   - optional E-Mail: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_VERIFIED_DOMAIN`,
     `RESEND_WEBHOOK_SECRET`, `WEBHOOK_SECRET`
3. **Resend-Webhook** im Dashboard auf `/api/webhooks/resend` zeigen lassen.
4. **PR #1 mergen**, sobald geprüft.

### Wichtige Stolperstellen
- **`GEOFENCE_RELAXED=true` ist nach dem Merge zwingend**, sonst werden Reports
  aus Deutschland verworfen — der neue Code erzwingt den Geofence auch im Code,
  nicht nur in der DB. Zum Launch Flag entfernen.
- **Ohne `ADMIN_SESSION_SECRET` schlägt der Admin-Login in Prod fehl** (bewusst).
- Für echten GR-Betrieb muss `countries` ein aktives Land mit geladener
  `boundary` haben (`is_active=true`, `boundary not null`), sonst lehnt der
  strikte Geofence alles ab. Check:
  `select code, is_active, (boundary is not null) from countries;`

---

## Bewusst offen gelassen (nicht in dieser Session)

- **Nonce-basiertes CSP-Hardening** — aktuell `script-src 'unsafe-inline'`
  (Next.js-Bootstrap). Braucht Nonce-Pipeline in der Middleware.
- **Expliziter CSRF-Token** — derzeit durch `SameSite=lax` ausreichend
  abgedeckt; expliziter Token wäre robuster.
- **Echtes Gesichts-/Kennzeichen-ML-Modell** — der `http`-Anonymizer-Seam steht,
  aber ein konkreter Dienst muss noch angebunden/gehostet werden.
- **Web-Push-*Sender*** — Subscriptions werden erfasst (`/api/push/subscribe`),
  aber der VAPID-Versand (Trigger bei Statuswechsel / Area-Follow) fehlt noch.
  `web-push` ist bereits Dependency; `VAPID_*`-Env-Vars existieren.
- **Open311-Zustellung** — `Open311Deliverer` ist Stub (`lib/providers/deliver.ts`).

---

## Gates / Befehle
```bash
npm run typecheck && npm run lint && npm run test   # alle grün (51 Tests)
```
