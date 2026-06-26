# Claude Code / Codex — Drosia: Architektur- & Build-Briefing (Clean Rebuild)

> Lege diese Datei als `CLAUDE.md` / `AGENTS.md` ins Repo-Root (oder als Project Instructions in der IDE). **Ziel:** Drosia **von Grund auf sauber** bauen — produktionsreif, EU-ready, mit allen Glaubwürdigkeits- und Rechts-P0 **von Tag 1 strukturell eingebaut**, damit die Altlasten des Vorgängers (Schema-Drift, Testdaten in Produktion, Deliverability-Lücke, fehlende Anonymisierung, Berlin im Board) gar nicht erst entstehen. **Monetarisierung ist out of scope.**
> **Marke/Design:** `DROSIA-BRAND-KONZEPT-2026-06-23.md` + `BRIEFING-CLAUDE-DESIGN-CleanRebuild-EUready-2026-06-23.md`. **Admin-Board (Operator-Tool, Auto-Mail an Gemeinde, Gemeinde-Verzeichnis):** `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md`. **Fachliche Grundlage:** `P0-UMSETZUNGS-BRIEF-2026-06-23.md`, `KATHAROS-LAUNCH-READINESS-PUNCHLISTE-2026-06-23.md`.

---

## 1. Projekt

**Drosia** (δροσιά = Frische), Domain **drosia.eu**. Login-freie Civic-Web-App: Bürger/Touristen melden **Müll, illegale Ablagerungen, Umweltverstöße** in <60 s ohne Konto. Ablauf: Foto → Standort (Foto-EXIF → Live-GPS → Karten-Pin) → **Geofence aufs Land** → **Zuordnung zur zuständigen Behörde (PostGIS)** → **Auto-Anonymisierung** → Moderation → **Zustellung (E-Mail oder Open311)** → öffentliche Tracking-Seite + Karte + **Behörden-Accountability-Index**.

**Launch: Griechenland (eine Insel-Region). Architektur & Datenmodell: ab Tag 1 EU-ready** — kein „Greece"/„Δήμος" hartcodiert; Land und Behörde sind **Daten, keine Konstanten**.

---

## 2. Nicht verhandelbare Prinzipien (gelten für ALLES)

1. **Login-frei & anonym.** Keine E-Mail-Sammlung, keine Konten, kein Login. Identität = anonymer, client-generierter **Geräte-Token**. Wiederkehr nur über **Web-Push**. (Token ist pro-Browser/verlustbehaftet — akzeptiert, nie durch E-Mail/Account „repariert".)
2. **Anonymisierung ist Pflicht.** Gesichter **und** Kfz-Kennzeichen werden **serverseitig unkenntlich gemacht, bevor** ein Foto auf irgendeiner öffentlichen/teilbaren Fläche erscheint (Karte, `/r/<token>`, Share-Card, OG-Image). Originale bleiben privat (nur Service-Role). Policy **„Müll dokumentieren, nicht Täter"**: nur Institutionen werden getaggt, **nie** Privatpersonen/-grundstücke.
3. **EU-ready & geo-neutral.** `country` + `authority` sind Daten. Behörden-Begriff lokalisiert (Δήμος/municipality/comune). i18n für viele Locales (Start EL/EN/DE). Keine Greece-only-Annahme im Code.
4. **Keine Test-/Seed-Daten in Produktion.** Seeds nur über ein **env-geflaggtes** Skript; jedes Demo-/Testobjekt trägt `is_test = true` und ist aus **allen** öffentlichen Aggregaten/Boards/Zählern ausgeschlossen. Zähler werden **berechnet**, nie hartcodiert. (Kein zweites „Berlin im Board".)
5. **Fairness & Recht.** Accountability-Ranking nur über **zugestellte** Reports, **n ≥ 10**, mit **Antwort-/Bestreitungsrecht** der Behörde und sichtbarem Disclaimer. **DSA-Notice-and-Takedown** an jedem öffentlichen Inhalt. Impressum, Datenschutz, Upload-Einwilligung.
6. **Schema = single source of truth, idempotent.** Migrationen additiv. **RLS überall.** Secrets nur serverseitig. Keine stillen Fehler (jeder Zustellweg loggt Status).

---

## 3. Stack

Next.js 16 (App Router, React 19) · TypeScript strict · **Supabase (Postgres + PostGIS + Storage + RLS)** · Resend + React Email · `sharp` · **Anonymisierungs-Provider** (Interface, s. §5.2) · Leaflet/react-leaflet · **Geocoding-Provider-Interface** (Nominatim default, swap-bar) · **Web Push (VAPID)** · Tailwind · Vitest · **PWA** · Vercel.
**PostGIS ist Pflicht** (Geofencing + Behörden-Zuordnung über echte Polygone, nicht Namens-Fuzzy-Matching).

---

## 4. EU-ready Datenmodell (`supabase/schema.sql`, idempotent, RLS überall)

Kernidee: **Land → Behörde → Report**, alles geo- und mehrsprachfähig. Skizze (Spalten/Constraints final im Schema ausformulieren):

```
countries (
  code text pk,                 -- ISO-3166 'GR','HR',...
  name_i18n jsonb,              -- {el,en,de,...}
  boundary geography(MultiPolygon,4326),  -- Geofence-Außengrenze
  default_locale text, locales text[],    -- aktive Sprachen
  is_active boolean default false         -- nur aktive Länder akzeptieren Reports
)

authorities (                   -- ersetzt 'municipalities', EU-neutral
  id uuid pk,
  country_code text references countries(code),
  name_i18n jsonb,
  level text,                   -- 'municipality'|'region'|'port'|'environment'|...
  geom geography(MultiPolygon,4326),      -- Zuständigkeitsgebiet (PostGIS)
  delivery_channel text,        -- 'email' | 'open311' | 'none'
  email_official text,          -- nullable
  open311_endpoint text, open311_jurisdiction text,  -- nullable
  is_active boolean, is_auto_created boolean default false  -- auto-created = Review
)

reports (
  id uuid pk,
  public_token text unique,     -- /r/<token>
  country_code text, authority_id uuid references authorities(id),
  category text,                -- enum-validiert serverseitig
  description text,             -- ≤500
  geom geography(Point,4326),
  status report_status,         -- s.u.
  locale text,
  author_token text,            -- nullable (Geräte-Token, für "meine Meldungen")
  created_at, notified_at, resolved_at, last_confirmed_at,
  vote_count int default 0, confirm_count int default 0,  -- denormalisiert
  is_test boolean default false,           -- NIE in Prod-Aggregaten
  excluded_from_ranking boolean default false  -- z.B. nicht-kommunale Kategorie
)

report_photos ( id, report_id, original_path,  -- privat, nur Service-Role
                 public_path,                   -- anonymisierte Variante
                 blur_status text )             -- 'pending'|'done'|'failed'

delivery_logs ( id, report_id, channel, recipient,
                provider_message_id, status,    -- queued|sent|delivered|bounced|failed|complained
                error text, created_at )

authority_responses ( id, report_id, authority_id, response_type,  -- in_progress|not_responsible|disputed|resolved
                       note, created_at )        -- Antwort-/Bestreitungsrecht (Fairness)

content_flags ( id, report_id, reason, reporter_contact, status, created_at )  -- DSA Notice-and-Takedown

anon_devices ( id, device_token unique, created_at, last_seen )
report_votes ( report_id, voter_token, type, created_at,  -- type: 'priority'|'still_here'
               unique(report_id, voter_token, type) )
push_subscriptions ( device_token, endpoint, keys jsonb, area_authority_id, created_at )
geocode_cache ( key text pk, payload jsonb, created_at )  -- gerundete lat/lng
```

**Status-State-Machine** (`report_status` enum):
`submitted → in_review → notified → resolved` (terminal) / `rejected` (terminal)
- `submitted` — eingereicht, Foto in Anonymisierung, **nicht öffentlich**.
- `in_review` — freigegeben, **öffentlich** (nur mit `blur_status='done'`), Zustellung ausgelöst.
- `notified` — an Behörde zugestellt (`notified_at`); **erst ab hier ranking-relevant**.
- `resolved` — behoben (`resolved_at`), Vorher/Nachher.
- `rejected` — Spam/ungültig/zeigt auf Privatperson.

---

## 5. Phasen

### Phase 0 — Scaffold & Leitplanken (zuerst, schafft Sauberkeit strukturell)
- Repo, `.env.example` (nur öffentliche Keys/Platzhalter), `.gitignore` (Service-Role-Key nie commit-bar).
- **CI ab Commit 1:** `npm run typecheck` + `npm run lint` + `npm run test` als Gate.
- `supabase/schema.sql` **idempotent**; PostGIS-Extension aktiviert; alle Enums/Indizes/RLS/Trigger drin. Frische Postgres-Instanz → exakt das Schema, das der Code liest.
- **Seed nur über `scripts/seed.ts` mit `SEED_ENV=dev`-Guard**; alle Seeds `is_test=true`. In Prod kein Seed.
- Provider-Interfaces anlegen (leer): `reverseGeocode()`, `anonymizeImage()`, `deliverReport()` — damit Austauschbarkeit von Anfang an steht.

### Phase 1 — Kern-Loop (capture → geofence → route → anonymize → moderate → deliver → track)
- **Submit** `POST /api/report`: Multi-Foto-Upload (sharp-Kompression, atomar — bei Fehler hochgeladene Blobs wieder löschen), EXIF-GPS → Live-GPS → Pin; Honeypot; **IP-Rate-Limit**; Input-Validierung (Kategorie-Enum, ≤500 Zeichen, Bildgrößen).
- **Geofence:** `ST_Within(point, country.boundary)` für ein **aktives** Land; sonst Ablehnung mit klarer Meldung. (Kein Berlin/Germencik möglich.)
- **Behörden-Routing:** Behörde = `authorities` deren `geom` den Punkt enthält (`ST_Contains`); kein Treffer → `authority_id=null` + Review-Flag (kein Junk-Auto-Create). Optional `geocode_cache`.
- **Anonymisierung** (s. §5.2 unten) läuft **vor** Freischaltung; `in_review` erst wenn `blur_status='done'`.
- **Moderation (Admin-Board):** Queue → Detail (anonymisiert + Original on-demand, auto-zugeordnete Behörde) → freigeben/ablehnen; „zeigt auf Privatperson/Privatgrund" → reject. **Bei Freigabe automatisch E-Mail an die zuständige Gemeinde mit Link zum Report.** Vollständige Operator-Spez (Workflow, Gemeinde-Verzeichnis/E-Mails, Auto-Mail, Magic-Link, Admin-Screens): `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md`.
- **Zustellung** `deliverReport()`: `email` (Resend + React Email) **oder** `open311` je `authority.delivery_channel`; schreibt `delivery_logs`; **nie still scheitern** (fehlt Behörden-Kanal → Status bleibt `in_review`, klar als „awaiting authority channel" markiert).
- **Public:** `/r/<token>` Status-Timeline; Karte mit Pins; Landing.

### Phase 2 — Glaubwürdigkeit & Recht (strukturell, nicht nachgelagert)
- **5.2 Anonymisierung:** `anonymizeImage()` erkennt + verpixelt **Gesichter & Kennzeichen** serverseitig (Edge Function / Queue; Provider/Modell hinter Interface, swap-bar). Public/Share/OG nutzen **ausschließlich** `public_path`; `original_path` über keine öffentliche Route erreichbar (RLS service-only, signierte URLs nur Moderation). Upload-Einwilligung (Checkbox).
- **Leaderboard-Fairness:** Ranking nur Behörden mit `notified_count ≥ 10`; Quote = `resolved/notified` (nur `notified`, nie `submitted/in_review`); `is_test` und `excluded_from_ranking` raus; `authority_responses` ermöglicht Bestreiten; sichtbarer Disclaimer (alle Sprachen).
- **DSA-Notice-and-Takedown:** sichtbarer „melden/beanstanden"-Button (`content_flags`) an jedem öffentlichen Inhalt; Offensichtlich-Rechtswidriges unverzüglich entfernen.
- **Deliverability:** `EMAIL_FROM` auf **drosia.eu** (in Resend verifizierte Domain, **SPF/DKIM/DMARC**); Startup-Check warnt, wenn `EMAIL_FROM`-Domain ≠ verifizierte Domain; **Bounce-/Complaint-Webhook** → `delivery_logs`; Admin-Ansicht mit Status + „erneut senden".
- **Recht/Seiten:** Impressum, Datenschutzerklärung (alle Verarbeitungen), Art.-30-Verzeichnis (Repo-Doc), Disclaimer „Meldungen = Nutzerangaben, keine behördliche Feststellung".

### Phase 3 — Engagement (anonym, Geräte-Token)
- `anon_devices` + `reports.author_token`; `report_votes` (`priority` 👍 + `still_here` 🔴, dedup via UNIQUE, IP-Rate-Limit); Crowd-„sieht erledigt aus" (`content`/confirm, **kein** direkter Statuswechsel; Promotion zu `resolved` erst ab N unabhängigen Tokens **oder** Admin); „Mein Impact" `/me/<token>` (ehrlich „Impact dieses Geräts"); **Web-Push** (VAPID) per-Report + Area-Follow. **Kein** Fingerprinting.

### Phase 4 — EU-Readiness-Gerüst (auch wenn nur GR aktiv)
- **i18n (nur Public-App):** Dictionaries pro Locale, **Key-Paritäts-Test**; Start EL/EN/DE, erweiterbar; keine UI-Strings hartcodiert. **Das Admin-Board ist davon ausgenommen: ausschließlich Englisch** (separate, nicht-lokalisierte Strings, nicht im Public-i18n) — bedienbar durch künftige internationale Mitarbeitende. **Ausnahme:** der **ausgehende Behörden-Mailtext** bleibt in der Sprache der Gemeinde (nicht Englisch).
- **Behörden-Abstraktion:** `level` + `delivery_channel`; **Open311-Implementierung** hinter `deliverReport()` (GeoReport v2) zusätzlich zu E-Mail.
- **Länder-Config:** neues Land = `countries`-Zeile (Grenze + Locales) + Behörden-Seed + Aktivierung — **kein Code-Change**.
- **„Drosia Index":** öffentlicher/jährlicher Report „frischeste Gemeinden" aus den Daten (positiv geframt; Presse-Hebel).

---

## 6. Sicherheits- & DB-Regeln (nie verletzen)

- `supabaseAdmin` (Service-Role) **nur serverseitig**; nie in Client-Komponenten importieren.
- **RLS nie schwächen.** Public liest nur `is_approved/in_review`-Reports **mit `blur_status='done'`** und **nur** `public_path`; Originale service-only; Schreibzugriffe nur über rate-limitierte Routen; Aggregat-Reads ohne `is_test`.
- Interne Webhooks (Zustellung/Bounce) `Bearer ${WEBHOOK_SECRET}`. Admin-Routen: Session prüfen, IDs als UUID validieren.
- Alle Eingaben validieren/begrenzen (Punkt im aktiven Land, Kategorie-Enum, ≤500 Zeichen, Bildgrößen).
- `schema.sql` idempotent; Migrationen additiv (`add column if not exists`), **nie `DROP TABLE`**; jede neue Tabelle mit RLS.

## 7. Deny patterns (niemals)
```
- Login/Konten bauen oder Bürger-E-Mails sammeln; Device-Fingerprinting
- unverpixelte Fotos öffentlich/teilbar; Originalfotos über öffentliche Route
- Privatpersonen/-grundstücke benennen oder taggen
- Test-/Seed-Daten in Produktion oder in öffentlichen Zählern/Boards
- "Greece"/"Δήμος" oder Einzelland-Annahmen hartcodieren (country/authority sind Daten)
- Service-Role-Key committen; RLS deaktivieren; ungeschützte mutierende Endpoints
- stille Zustellfehler (jeder Weg loggt Status); DROP TABLE; Payments/Billing
```

## 8. Test-Gates (jede Phase)
1. `npm run typecheck` → 0 Fehler. 2. `npm run lint` → clean. 3. `npm run test` → grün.
4. `schema.sql` auf frische Postgres+PostGIS → matcht jede vom Code gelesene Spalte.
Pflicht-Testfälle: **Geofence** (Athen rein, Berlin/Meer raus), **Anonymisierung** (Foto mit Gesicht/Kennzeichen → public verpixelt, Original nicht öffentlich erreichbar), **Leaderboard-Fairness** (n=9 nicht gelistet; Nenner ignoriert `submitted`/`in_review`/`is_test`), **Zustellung** (verifizierte Domain; Bounce → `delivery_logs`; Open311-Pfad gemockt), **i18n-Parität**, **Vote-Dedup + Rate-Limit**, **E2E** submit→anonymize→moderate→deliver→track→resolve.

## 9. Definition of Done
Frischer Clone + neues Supabase-Projekt + dokumentierte Env-Vars kann: `schema.sql` ausführen, GR-Behörden seeden (real, nicht `is_test`), `npm run dev`, einen Report einreichen (Geofence greift), Foto wird anonymisiert, moderieren, **echte Zustellung** (drosia.eu-Mail im Posteingang **oder** Open311), Tracking/Karte zeigen Fortschritt, Leaderboard zeigt **keine** Behörde unter n=10 und **kein** Auslandsobjekt — Tests grün, **keine stillen Fehler**. Pro Phase ein PR mit Audit-Notiz + Testergebnis.

## 10. Übergabe-Prompt
> Lies dieses Dokument als `CLAUDE.md`. Baue Drosia greenfield in der Phasenreihenfolge 0→4. `supabase/schema.sql` ist die idempotente Single Source of Truth; PostGIS für Geofencing/Routing. Halte die nicht verhandelbaren Prinzipien (§2) und Deny patterns (§7) strikt ein. Committe pro Phase getrennt, jeweils mit grünem typecheck/lint/test. Melde am Ende jeder Phase: Schema-Status, Testergebnisse, und den Deliverability-Check (drosia.eu verifiziert?).
