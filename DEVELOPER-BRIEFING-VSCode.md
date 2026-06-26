# Drosia — Developer-Briefing (Umsetzung mit VS Code)

> **Zweck dieses Dokuments:** Ein Entwickler soll Drosia von Null in **VS Code** aufsetzen und produktionsreif bauen können — ohne dass jemand danebensitzt. Es verzahnt die **Architektur-Vorgabe** (`BRIEFING-CLAUDE-CODE-Drosia-Architektur-2026-06-23.md`, gehört als `CLAUDE.md` ins Repo-Root) mit dem **Design-Handoff** (`design_handoff_drosia/`, die `.dc.html`-Referenzen + Screenshots).
>
> **Lesereihenfolge:** dieses Briefing → `CLAUDE.md` (verbindliche Regeln) → `design_handoff_drosia/README.md` (Pixel-Vorgaben). Bei Widerspruch gewinnt `CLAUDE.md` für Architektur/Recht, der Design-Handoff für Optik/Copy.

---

## 0. Was Drosia ist (in 30 Sekunden)

Login-freie Civic-Web-App. Bürger/Touristen melden Müll & Umweltverstöße in <60 s **ohne Konto**: Foto → Standort → Geofence aufs Land → Zuordnung zur zuständigen Behörde via **PostGIS** → **serverseitige Anonymisierung** (Gesichter + Kennzeichen) → Moderation im Admin-Board → **Auto-E-Mail an die Gemeinde** → öffentliche Tracking-Seite + Karte + fairer Behörden-Accountability-Index.

**Launch:** Griechenland (eine Insel-Region). **Architektur ab Tag 1 EU-ready** — `country` und `authority` sind **Daten, keine Konstanten**; nichts auf „Greece"/„Δήμος" hartcodiert.

**Out of scope:** Monetarisierung, Konten, Bürger-E-Mail-Sammlung, Fingerprinting.

---

## 1. Stack & Versionen

| Bereich | Wahl |
|---|---|
| Framework | **Next.js 16** (App Router, React 19) |
| Sprache | **TypeScript strict** |
| Datenbank | **Supabase** — Postgres + **PostGIS** + Storage + RLS |
| E-Mail | **Resend** + React Email |
| Bildverarbeitung | **sharp** (Kompression) + **Anonymisierungs-Provider** hinter Interface |
| Karte | **Leaflet / react-leaflet** |
| Geocoding | Provider-Interface (Nominatim default, austauschbar) |
| Push | **Web Push (VAPID)** |
| Styling | **Tailwind** (Design-Tokens aus dem Handoff) |
| Tests | **Vitest** |
| App-Typ | **PWA** |
| Hosting | **Vercel** (App) + Supabase (DB/Storage) |

**PostGIS ist Pflicht** — Behörden-Zuordnung läuft über echte Polygone (`ST_Contains`), nicht über Namens-Fuzzy-Matching.

---

## 2. VS Code einrichten

### 2.1 Empfohlene Extensions
Lege diese als `.vscode/extensions.json` ins Repo, damit das Team denselben Satz bekommt:

```jsonc
{
  "recommendations": [
    "dbaeumer.vscode-eslint",              // ESLint
    "esbenp.prettier-vscode",              // Prettier
    "bradlc.vscode-tailwindcss",           // Tailwind IntelliSense
    "ms-vscode.vscode-typescript-next",    // aktuelles TS
    "vitest.explorer",                     // Vitest Test-Runner im UI
    "supabase.supabase-vscode",            // Supabase (optional)
    "mikestead.dotenv",                    // .env Syntax
    "yoavbls.pretty-ts-errors",            // lesbare TS-Fehler
    "formulahendry.auto-rename-tag"
  ]
}
```

### 2.2 Workspace-Settings (`.vscode/settings.json`)
```jsonc
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]],
  "files.eol": "\n"
}
```

### 2.3 Lokale Voraussetzungen
- **Node ≥ 20 LTS** (`node -v`), npm ≥ 10.
- **Docker Desktop** — für `supabase start` (lokales Postgres+PostGIS+Storage, kein Cloud-Projekt nötig zum Entwickeln).
- **Supabase CLI** (`npm i -g supabase` oder via Brew).
- Optional: **Vercel CLI** (`npm i -g vercel`) für `vercel dev` / Deploy.

### 2.4 Debugging (`.vscode/launch.json`)
Ein „Next.js: debug full stack"-Profil reicht; Breakpoints in `app/api/**` Route-Handlers funktionieren damit serverseitig. Für Edge/Queue-Funktionen (Anonymisierung) per Log + Vitest testen, nicht im Browser-Debugger.

---

## 3. Projekt-Setup (frischer Clone → laufende App)

```bash
# 1. Abhängigkeiten
npm install

# 2. Env-Datei
cp .env.example .env.local       # Werte eintragen (s. §4)

# 3a. Lokale DB (empfohlen für Dev)
supabase start                   # startet Postgres+PostGIS+Storage in Docker
supabase db reset                # wendet supabase/schema.sql idempotent an

# 3b. ODER Cloud: Supabase-Projekt anlegen, PostGIS-Extension aktivieren,
#     supabase/schema.sql im SQL-Editor ausführen

# 4. Dev-Seed (NUR lokal/dev — niemals Prod)
SEED_ENV=dev npm run seed        # aktiviert Griechenland, alle Demo-Reports is_test=true

# 5. Start
npm run dev                      # http://localhost:3000
```

**Wichtig:** Die Sender-Domain **drosia.eu** muss in Resend verifiziert sein (SPF/DKIM/DMARC), **bevor** echte Zustellung getestet wird — das ist ein **P0-Blocker**, kein Nice-to-have. Bis dahin läuft die Zustellung gegen einen gemockten Provider.

---

## 4. Environment-Variablen (`.env.example`)

Nur Platzhalter/öffentliche Keys committen. **Service-Role-Key, VAPID-Private, Webhook-Secret → niemals ins Repo.**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # SERVER-ONLY, nie im Client importieren

# E-Mail (Resend)
RESEND_API_KEY=
EMAIL_FROM=reports@drosia.eu      # Domain MUSS in Resend verifiziert sein

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Interne Webhooks (Zustellung/Bounce)
WEBHOOK_SECRET=

# Geocoding
GEOCODER_PROVIDER=nominatim
GEOCODER_BASE_URL=

# Seed-Guard
SEED_ENV=                         # nur 'dev' erlaubt Seeding
```

`.gitignore` muss `.env*` (außer `.env.example`) und jeden Service-Key sicher ausschließen.

---

## 5. Repo-Struktur

```
drosia/
├─ CLAUDE.md                 # verbindliche Build-Regeln (Architektur-Briefing)
├─ app/                      # Next.js App Router
│  ├─ (public)/              # mobile-first, i18n EL/EN/DE
│  │  ├─ page.tsx            # Landing  → Design: Screen 6
│  │  ├─ map/                # Karte    → Screen 2
│  │  ├─ report/             # Melden-Flow → Screen 3+4
│  │  ├─ r/[token]/          # Tracking → Screen 1
│  │  ├─ urgent/             # Top-Liste → Screen 5
│  │  ├─ authority/[id]/     # Scorecard → Screen 7
│  │  └─ me/[token]/         # Mein Impact → Screen 8
│  ├─ admin/                 # Desktop, ENGLISCH-ONLY → Admin Board A1–A6
│  └─ api/                   # Route-Handler (report, vote, webhooks, admin)
├─ components/               # UI-Primitive aus den Design-Tokens
├─ lib/
│  ├─ supabase/              # client (anon) + admin (service-role, server-only)
│  ├─ providers/             # geocoding · anonymize · deliver (austauschbar)
│  ├─ i18n/                  # el/en/de + Paritäts-Test
│  ├─ geo.ts                 # Pre-Filter + geocode-cache Keys
│  └─ categories.ts          # Report-Kategorien (synchron mit SQL-Enum)
├─ supabase/schema.sql       # Single Source of Truth (idempotent, PostGIS, RLS, Fairness-Views)
├─ scripts/seed.ts           # dev-only, SEED_ENV-guarded
└─ tests/                    # i18n-Parität · geo · fairness · delivery · e2e
```

---

## 6. Vom Design zur Implementierung

Die Dateien in `design_handoff_drosia/` sind **Referenz-Prototypen in HTML**, **nicht** zum direkten Ausliefern. Nachbauen mit den Primitives des Codebases (React/Tailwind), pixelgenau.

### 6.1 Design-Tokens zuerst in Tailwind gießen
Aus `design_handoff_drosia/README.md` die Farb-, Typo- und Radius-Tokens in `tailwind.config.ts` übertragen. Kern:

```ts
// tailwind.config.ts (Auszug)
theme: {
  extend: {
    colors: {
      primary:   { DEFAULT: '#00B4C8', ink: '#00A6BC', dark: '#1ECAD9' },
      success:   '#2ECC71',
      accent:    '#FFC247',
      ink:       '#0B2B30',
      slate:     '#5B7378',
      muted:     '#9DB1B5',
      surface:   { DEFAULT: '#F7FBFC', card: '#FFFFFF' },
      severity:  { fresh: '#2ECC71', lukewarm: '#F4D03F', stale: '#E67E22', spoiled: '#E74C3C' },
      // Dark (siehe Handoff „Drosia Dark Mode")
      dark:      { bg: '#04181D', surface: '#07232A', raised: '#0B2B30', border: '#173B43',
                   ink: '#EAF4F5', slate: '#9FC4C9', muted: '#6E8A90' },
    },
    fontFamily: { display: ['Nunito', 'sans-serif'], body: ['Mulish', 'sans-serif'] },
    borderRadius: { card: '18px', phone: '34px', pill: '999px' },
  }
}
```
**Regeln aus dem Handoff, die NICHT verhandelbar sind:**
- Alle Zahlen `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`).
- Severity-Breakpoints fix: 🟢 <7 T · 🟡 <30 T · 🟠 <60 T · 🔴 >60 T (Alter seit `notified_at ?? created_at`).
- Resolved zeigt Originalfoto + grünen Haken, **kein** Nachher-Foto.
- Dark Mode: Marke/Severity/Mint bleiben, nur Flächen/Text/Ränder invertieren, Aqua → `#1ECAD9`. Mapping-Tabelle im Handoff-README + `Drosia Dark Mode`-Datei.

### 6.2 Screen ↔ Route Mapping
| Design-Datei | Route | States zu bauen |
|---|---|---|
| Screen 6 — Landing | `/` | Leaderboard / Pre-Launch (n<10) |
| Screen 2 — Karte | `/map` | Pins / Heatmap / Empty |
| Screen 1 — Tracking | `/r/[token]` | Default / Resolved / Loading / 404 |
| Screen 3+4 — Melden-Flow | `/report` | 4 Gated Steps + Success |
| Screen 5 — Top-Liste | `/urgent` | Near me / Region / Nationwide |
| Screen 7 — Scorecard | `/authority/[id]` | Ranked / Not-ranked / Disputed |
| Screen 8 — Mein Impact | `/me/[token]` | with-data / empty |
| Screen 9 — ShareCard | OG-Image-Route | New / Ignored / Resolved |
| Admin Board A1–A6 | `/admin/**` | Login → Queue → Detail+Email-Modal → Directory → Delivery → Flags |

### 6.3 i18n-Grenze beachten
Public-App = **EL/EN/DE** (Dictionaries, Key-Paritäts-Test, keine UI-Strings hartcodiert). **Admin-Board = ausschließlich Englisch** (separate, nicht-lokalisierte Strings). **Ausnahme:** der **ausgehende Behörden-Mailtext** ist in der Sprache der Gemeinde, nicht Englisch.

---

## 7. Build-Reihenfolge (Phasen — ein PR pro Phase)

Aus `CLAUDE.md §5`. Jede Phase endet mit grünen Gates (§8) + Audit-Notiz.

- **Phase 0 — Scaffold & Leitplanken:** Repo, `.env.example`, `.gitignore`, CI ab Commit 1, idempotentes `schema.sql` (PostGIS, Enums, Indizes, RLS, Trigger), Seed nur via `SEED_ENV=dev`-Guard, leere Provider-Interfaces (`reverseGeocode`, `anonymizeImage`, `deliverReport`).
- **Phase 1 — Kern-Loop:** Submit-API (Multi-Foto, sharp, atomar, Honeypot, IP-Rate-Limit, Validierung), Geofence (`ST_Within` aufs aktive Land), Behörden-Routing (`ST_Contains`, kein Treffer → Review-Flag), Anonymisierung **vor** Freischaltung, Admin-Moderation + Auto-Mail, Zustellung (E-Mail/Open311) mit `delivery_logs`, Public `/r/<token>` + Karte + Landing.
- **Phase 2 — Glaubwürdigkeit & Recht:** Anonymisierung (Gesichter+Kennzeichen, Provider hinter Interface), Leaderboard-Fairness (n≥10, nur `notified`, `is_test`/`excluded` raus, Bestreitungsrecht, Disclaimer), DSA-Notice-and-Takedown an jedem öffentlichen Inhalt, Deliverability (verifizierte Domain, Bounce/Complaint-Webhook), Rechtsseiten (Impressum, Datenschutz, Art.-30).
- **Phase 3 — Engagement (anonym):** `anon_devices` + `author_token`, Votes (`priority` 👍 / `still_here` 🔴, UNIQUE-Dedup, Rate-Limit), Crowd-„sieht erledigt aus" (kein direkter Statuswechsel), „Mein Impact" `/me/<token>`, Web-Push (VAPID) per-Report + Area-Follow. **Kein Fingerprinting.**
- **Phase 4 — EU-Readiness:** i18n-Gerüst (Key-Parität), Behörden-Abstraktion + Open311 (GeoReport v2), Länder-Config (neues Land = DB-Zeile, kein Code-Change), „Drosia Index".

---

## 8. Quality-Gates (jede Phase, in VS Code + CI)

```bash
npm run typecheck   # 0 Fehler (TS strict)
npm run lint        # clean
npm run test        # Vitest grün
# + schema.sql wendet sich auf frisches Postgres+PostGIS sauber an
```
Im VS Code laufen Typecheck/Lint live (Extensions), Tests über den **Vitest Explorer**. CI (GitHub Actions o. ä.) muss dieselben drei Befehle als **Merge-Gate** fahren — ab Commit 1.

**Pflicht-Testfälle:** Geofence (Athen rein, Berlin/Meer raus) · Anonymisierung (Gesicht/Kennzeichen → public verpixelt, Original nicht öffentlich erreichbar) · Leaderboard-Fairness (n=9 nicht gelistet; Nenner ignoriert `submitted`/`in_review`/`is_test`) · Zustellung (verifizierte Domain, Bounce → `delivery_logs`, Open311 gemockt) · i18n-Parität · Vote-Dedup + Rate-Limit · E2E submit→anonymize→moderate→deliver→track→resolve.

---

## 9. Deny-Patterns (niemals — Code-Review lehnt ab)

```
- Login/Konten bauen oder Bürger-E-Mails sammeln; Device-Fingerprinting
- unverpixelte Fotos öffentlich/teilbar; Originalfotos über eine öffentliche Route
- Privatpersonen/-grundstücke benennen oder taggen
- Test-/Seed-Daten in Produktion oder in öffentlichen Zählern/Boards
- "Greece"/"Δήμος" oder Einzelland-Annahmen hartcodieren (country/authority = Daten)
- Service-Role-Key committen; RLS deaktivieren; ungeschützte mutierende Endpoints
- stille Zustellfehler (jeder Weg loggt Status); DROP TABLE; Payments/Billing
```

---

## 10. Sicherheits- & DB-Regeln (Kurzfassung)

- `supabaseAdmin` (Service-Role) **nur serverseitig** — nie in Client-Komponenten importieren.
- **RLS nie schwächen.** Public liest nur `in_review`-Reports **mit `blur_status='done'`** und **nur** `public_path`; Originale service-only; öffentliche Aggregate über **Views** ohne `is_test`.
- Interne Webhooks: `Bearer ${WEBHOOK_SECRET}`. Admin-Routen: Session prüfen, IDs als UUID validieren.
- `schema.sql` idempotent, Migrationen additiv (`add column if not exists`), **nie `DROP TABLE`**, jede neue Tabelle mit RLS.

---

## 11. Definition of Done

Frischer Clone + neues Supabase-Projekt + dokumentierte Env-Vars kann: `schema.sql` ausführen → GR-Behörden seeden (real, nicht `is_test`) → `npm run dev` → Report einreichen (Geofence greift) → Foto wird anonymisiert → moderieren → **echte Zustellung** (drosia.eu-Mail im Posteingang **oder** Open311) → Tracking/Karte zeigen Fortschritt → Leaderboard zeigt **keine** Behörde unter n=10 und **kein** Auslandsobjekt. Tests grün, **keine stillen Fehler**. Pro Phase ein PR mit Audit-Notiz + Testergebnis.

---

## 12. Erster Arbeitstag — konkrete Checkliste

1. Repo klonen, `CLAUDE.md` + `design_handoff_drosia/README.md` lesen, Screenshots ansehen.
2. VS Code: empfohlene Extensions installieren (Prompt erscheint via `extensions.json`).
3. `npm install`, `.env.local` aus `.env.example`, Docker starten, `supabase start`.
4. `supabase db reset` → prüfen, dass `schema.sql` sauber durchläuft (PostGIS aktiv?).
5. `SEED_ENV=dev npm run seed`, `npm run dev` → Landing lädt.
6. Tailwind-Tokens aus §6.1 setzen, eine Komponente (z. B. Severity-Pill) gegen die Design-Datei nachbauen → Pixel-Abgleich.
7. `npm run typecheck && npm run lint && npm run test` grün? Dann erste PR gegen Phase 0.

---

### Referenz-Dokumente im Projekt
- `CLAUDE.md` — verbindliche Architektur-/Rechtsregeln (gehört ins Repo-Root).
- `design_handoff_drosia/README.md` — vollständige Design-Tokens (Light+Dark), Screen-Specs, States, Interaktionen.
- `design_handoff_drosia/screenshots/` — gerenderte Referenzen aller Schlüssel-Screens.
- `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md` — Operator-Workflow, Gemeinde-Verzeichnis, Auto-Mail, A1–A6.
- `DROSIA-BRAND-KONZEPT-2026-06-23.md` — Marke, Tonalität, Logo.
