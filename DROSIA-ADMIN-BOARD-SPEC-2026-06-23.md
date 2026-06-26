# Drosia — Admin-Board / Operator-Spezifikation

**Datum:** 2026-06-23 · **Ergänzt:** `BRIEFING-CLAUDE-CODE-Drosia-Architektur-2026-06-23.md` (Technik) + `BRIEFING-CLAUDE-DESIGN-CleanRebuild-EUready-2026-06-23.md` (UI).
**Warum dieses Doc:** Das Admin-Board war im Konzept nur implizit. Es ist aber das **operative Herz** — dein tägliches *Verifizieren → Sichten → Online-Schalten → Auto-Mail-an-Gemeinde*. Außerdem liegen hier das **Gemeinde-Verzeichnis + E-Mail-Adressen** und der **Auto-Versand**. Diese Spec schreibt das aus. (Fähigkeiten sind aus deinem bestehenden GreeceClean-Admin bekannt — Moderations-Dashboard, `MunicipalityEmailList`, `approve/forward/reject/mark_cleaned`, `email_logs` — und werden sauber, EU-ready und mit gefixten P0 übernommen.)

**Sprache: Das Admin-Board-UI ist ausschließlich Englisch** — nicht lokalisiert, **kein** Teil des öffentlichen i18n-Systems. Grund: Das Board soll künftig von neuen/internationalen Mitarbeitenden bedient werden können. Die **Public-App bleibt mehrsprachig** (EL/EN/DE …); nur das Operator-Tool ist EN-only (alle Labels, Buttons, Status, Reject-Gründe, Hilfetexte auf Englisch).
**Wichtige Abgrenzung:** Die **Auto-E-Mail an die Gemeinde** bleibt in der **Sprache der Empfänger-Behörde** (z. B. Griechisch für GR-Δήμοι) — Englisch betrifft **nur die Bedienoberfläche** des Boards, **nicht** den ausgehenden Behörden-Mailtext.

---

## 1. Einordnung: Das Board ist zugleich die Haftungsfläche

Zwei Dinge leben **nur** hier — und beide sind heikel:

1. **Das Verifizieren→Veröffentlichen-Gate.** Weil du **manuell vorab moderierst**, machst du dir die Inhalte rechtlich „zu eigen" → **volle Inhaltehaftung** (DDG/DSA). Genau deshalb sind im Board **nicht verhandelbar**: nur die **anonymisierte** Fotovariante wird veröffentlicht, und die Policy **„Müll dokumentieren, nicht Täter"** (keine Privatpersonen/-grundstücke) ist als Reject-Grund fest eingebaut.
2. **Das Gemeinde-Verzeichnis + der Auto-Versand.** Hier entscheidet sich, ob der Kern-Loop überhaupt funktioniert (richtige Adresse, zugestellte Mail).

---

## 2. Operator-Workflow (die tägliche Schleife)

1. **Neue Meldung** → Status `submitted`, Foto wird auto-anonymisiert (`blur_status`), **nicht öffentlich**.
2. **Moderations-Queue:** Liste der `submitted`-Reports, sortierbar nach Alter/Severity/Votes.
3. **Report-Moderations-Detail:** anonymisiertes Foto (+ Original nur per **signierter URL** zur Verifikation), **automatisch zugeordnete Behörde** (PostGIS `ST_Contains`), Standort/Karte, Kategorie, Beschreibung. Admin kann: Kategorie/Behörde **korrigieren**, **freigeben**, oder **ablehnen** (Gründe inkl. „zeigt auf Privatperson/Privatgrund").
4. **Freigeben** → Status `in_review` (öffentlich, **nur anonymisiert**) → **`deliverReport()` schickt automatisch die E-Mail an die Gemeinde mit Link zum Report** → Status `notified`, `notified_at` gesetzt, Eintrag in `delivery_logs`.
5. **Später:** als `resolved` markieren (mit Vorher/Nachher) — durch dich **oder** durch die Gemeinde selbst per Magic-Link (§4).

---

## 3. Die Auto-E-Mail an die Gemeinde (deine Kernidee, explizit spezifiziert)

- **Auslöser:** Freigabe/Online-Schalten (`in_review` → `notified`). Kein separater manueller Schritt nötig (optional: „Freigeben & senden" als ein Klick, mit Vorschau).
- **Empfänger:** `authority.email_official` der automatisch zugeordneten Gemeinde.
- **Inhalt** (React-Email-Template, lokalisiert in der Sprache des Landes/der Gemeinde): Betreff (Kategorie + Ort), **anonymisiertes** Foto, Standort (Karten-Link), Kategorie, Datum — und ein **Link zum Report**: die öffentliche Tracking-Seite `/r/<token>` **und** eine dedizierte Behörden-Ansicht (Magic-Link, §4).
- **Keine Gemeinde-E-Mail hinterlegt?** Nicht scheitern: Report bleibt `in_review`, wird im Verzeichnis als **„wartet auf Behörden-E-Mail"** markiert; Versand sobald nachgetragen.
- **Logging:** jeder Versand → `delivery_logs` (`queued/sent/delivered/bounced/failed/complained`); im Board sichtbar mit **„erneut senden"**.
- **Voraussetzung (P0!):** Absenderdomain **drosia.eu** in Resend verifiziert (**SPF/DKIM/DMARC**). Sonst landet die Auto-Mail im Spam — das war der stille Totalausfall des Vorgängers. **Startup-Check** warnt, wenn `EMAIL_FROM`-Domain ≠ verifiziert.
- **Eskalation (P1, optional):** keine Reaktion nach X Tagen → Erinnerungsmail; später CC an Περιφέρεια/Umweltinspektion.

---

## 4. Magic-Link-Behördenansicht (empfohlene Evolution deiner Idee)

Deine beschriebene Idee = **Link zum Report** (Gemeinde liest). Starkes Upgrade: Der Link ist ein **signierter Magic-Link** (pro Report bzw. pro Gemeinde, gleiches Token-Prinzip wie `/r/<token>`, **kein Login**) auf eine schlanke Behörden-Ansicht, in der die Gemeinde den **Status selbst setzen** kann: `in_progress` / `resolved` / `not_responsible` / `disputed`, optional mit Nachher-Foto.

Nutzen:
- **Löst den Admin-Flaschenhals** — du musst nicht jede Lösung selbst markieren.
- **Speist die Leaderboard-Fairness** (`authority_responses`: Antwort-/Bestreitungsrecht).
- **Gibt der Gemeinde Handlungsmacht** → höhere Reaktionswahrscheinlichkeit.

Empfehlung: für P1 einplanen; P0-Launch kann mit reinem Lese-Link starten.

---

## 5. Gemeinde-Verzeichnis (`authorities`) — Verwaltung im Board

- **CRUD** auf `authorities`: `name_i18n`, `level`, `geom` (Zuständigkeitsgebiet), `email_official`, `delivery_channel` (email/open311), `is_active`.
- **„Fehlt-E-Mail"-Ansicht:** Gemeinden ohne `email_official`, sortiert nach Anzahl offener Reports → du füllst die wirkungsstärksten Lücken zuerst (übernimmt deine bestehende `MunicipalityEmailList`).
- **Bounce-Status je Gemeinde** (aus `delivery_logs`) → tote Adressen erkennen.
- **Seed:** reale GR-Gemeinden (332, nicht „338") über env-geflaggtes Seed-Skript; **nie `is_test` in Prod**.
- **EU-ready:** dieselbe Verwaltung funktioniert für die Behörden jedes Landes.

---

## 6. Moderation & Recht (im Board verankert)

- Öffentlich/teilbar **ausschließlich** die anonymisierte Fotovariante; Original nur per signierter URL im Moderations-Detail.
- Reject-Gründe inkl. „zeigt auf Privatperson/Privatgrund" (Policy „Müll dokumentieren, nicht Täter").
- **Takedown-Queue:** `content_flags` (DSA Notice-and-Takedown) — eingehende Beanstandungen bearbeiten/entfernen.
- **Dispute-Queue:** `authority_responses` mit `disputed`/`not_responsible` — beeinflusst Ranking.
- **Audit-Log** aller Admin-Aktionen (wer hat wann was freigegeben/bearbeitet/gelöscht).

---

## 7. Auth & Rollen

- **Launch-Baseline:** ein Admin, Passwort + HMAC-Cookie-Session (wie bisher). `supabaseAdmin` nur serverseitig; IDs als UUID validieren; rate-limitiert.
- **Evolution:** Rollen/Mehrbenutzer (Moderator vs. Admin), um den Ein-Personen-Flaschenhals zu lösen (in der Analyse als Skalierungsdeckel benannt). Optional, nach Launch.

---

## 8. Admin-Screens (für Claude Design — Ergänzung zum Design-Briefing)

Eigene Sektion, **Desktop-first** (anders als die mobile-first Public-App), **komplett auf Englisch**, funktional/dicht/schnell — Operator-Tool, kein Consumer-UI:

1. **Admin-Login.**
2. **Moderations-Queue** (Pending-Liste, Filter, Alter/Severity/Votes).
3. **Report-Moderations-Detail** (anonymisiert + Original-on-demand, zugeordnete Behörde, Edit, „Freigeben & senden", Reject-Gründe).
4. **Gemeinde-Verzeichnis** (Liste, „Fehlt-E-Mail"-Ansicht, Bounce-Status, CRUD, Coverage-Karte).
5. **Zustell- & Bounce-Monitor** (Status je Report, „erneut senden").
6. **Flags/Takedown + Disputes** (Queue).

---

## 9. Datenmodell-Bezug (bereits im Architektur-Briefing vorhanden)

`authorities` (`email_official`, `delivery_channel`, `geom`), `reports` (`status`, `notified_at`, `author_token`), `delivery_logs`, `authority_responses`, `content_flags`. Diese Spec beschreibt die **Operator-Schicht** darüber.

---

## 10. Definition of Done (Admin-Board)

Neue Meldung → erscheint in Queue → anonymisiert → Freigabe → **echte E-Mail an die zuständige Gemeinde mit funktionierendem Report-Link** → Status `notified`, geloggt → lösbar (Admin **oder** Magic-Link) → Public/Karte/Tracking spiegeln den Stand. Gemeinden ohne E-Mail werden sichtbar gemacht. Bounces sichtbar. Takedown funktioniert. **Kein stiller E-Mail-Fehler.**
