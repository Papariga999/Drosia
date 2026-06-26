# Claude Design — Briefing: Clean Rebuild, EU-ready (Web-App from scratch)

> **Marke:** Die App heißt **Drosia** (griech. δροσιά = Frische / kühle Erfrischung), Domain **drosia.eu**. Vollständige Markenwelt — Claim, Tonalität, Logo (Tropfen-als-Karten-Pin), Farbkonzept „Morning Freshness", Maskottchen-Option — siehe `DROSIA-BRAND-KONZEPT-2026-06-23.md`. Der Name ist geo-neutral, sodass die spätere EU-Expansion **ohne Rebrand** möglich ist.

**Auftrag:** Die Civic-Web-App **von Grund auf neu und sauber** als Design-System + Screens entwerfen. Nicht das alte GreeceClean/Katharos-UI fortschreiben, sondern ein **kohärentes, produktionsreifes, EU-ready Design** from scratch. Mobile-first, PWA-installierbar ab Tag 1.

---

## 1. Projektkontext

**Drosia** ist eine **login-freie Civic-Web-App**, mit der Bürger und Touristen **illegale Müllkippen, Strandmüll und Umweltverstöße melden** — in unter 60 Sekunden, ohne Konto. Nutzer fotografiert → App erkennt Standort (Foto-GPS → Live-GPS → Karten-Pin) → ordnet der zuständigen Behörde zu → leitet nach Moderation an deren Postfach weiter. Jede Meldung erhält eine öffentliche Tracking-Seite, erscheint auf einer Karte und fließt in ein **öffentliches Accountability-Ranking** der Behörden.

**Launch: Griechenland (eine Insel-Region zuerst). Architektur & Marke: von Anfang an EU-ready.** Das Design muss also für GR funktionieren, aber **nirgends auf „nur Griechenland" hartcodiert** sein (Sprache, Branding, Geo, Behörden-Begriffe sind parametrisch).

**Was die App im Kern ist:** kein „Melde-Formular", sondern ein **Accountability- & Community-Tool** — „mach sichtbar, wer handelt und wer nicht". Die Zahlen (Tage offen, Votes, Lösungsquote) sind das emotionale Zentrum.

**Zwei Oberflächen, bewusst unterschiedlich:** (A) die **Public-App** (mobile-first, mehrsprachig) — der Großteil dieses Briefings, Abschnitt 6; und (B) das **Admin-Board** (internes Operator-Tool, **Desktop-first, ausschließlich Englisch**) — Abschnitt 6b. Public = hell/emotional/mobil; Admin = dicht/funktional/schnell.

---

## 2. Das zentrale Designprinzip (gilt für ALLES): anonym & login-frei

**Heilig, nie aufweichen.** Keine E-Mails, keine Konten, kein Login. Identität = **ausschließlich ein unsichtbarer Geräte-Token** (zufällige ID in `localStorage`):
- Token genügt für: Upvote, „ich auch", „behoben"-Bestätigung, „meine Meldungen", Doppelklick-Schutz, persönliche Impact-Ansicht. **Kein Anmelde-UI, kein E-Mail-Feld.**
- Wiederkehr/Updates **ohne E-Mail:** nur über **Web-Push** (Browser-Berechtigung, an Token gebunden) + bookmarkbarer „Mein-Impact"-Link.

Design-Konsequenzen: (1) Engagement-Buttons einladend, nie blockierend. (2) Identität ehrlich als **„Impact dieses Geräts"** labeln (Cache löschen = neue Identität) — kein UI, das ein dauerhaftes Konto verspricht.

---

## 3. EU-Ready by Design (NEU — der Unterschied zum alten Build)

Das Design muss von Tag 1 mehrsprachig und mehr-jurisdiktionsfähig gedacht sein, auch wenn GR zuerst live geht:

- **Sprache:** Architektur für **viele Locales**, nicht fix 3. Start: **EL / EN / DE**; das Sprach-/Regions-UI muss problemlos **FR, IT, ES, HR …** aufnehmen. Sprachumschalter als skalierbares Menü (nicht 3 feste Flaggen). Niemals Text hartcodieren — alles über i18n-Keys; Designs müssen mit **langen Strings** (DE/FR) und **kurzen** (EN) sowie griechischen Zeichen sauber umbrechen.
- **Geo-neutrale Marke:** Visuelle Identität trägt **Drosia**, **nicht** Ägäis-/Griechenland-Motive als Fixpunkt. Cleane, freundliche, europäisch lesbare Bildsprache. (Optional pro Region ein dezentes Akzent-Theme, aber das Kern-Design ist länderunabhängig.)
- **Behörden-Begriff parametrisch:** Heute „Δήμος/Gemeinde", morgen „municipality/commune/comune". Im UI nie „Δήμος" hartcodieren — immer die lokalisierte „zuständige Behörde".
- **Karten-/Regions-Logik:** UI funktioniert für Insel, Stadt, Land und (später) mehrere Länder — Filter „in meiner Nähe / meine Region / landesweit" generisch.

---

## 4. Nutzer-Profil & Tone

- **Nutzer A — Einheimischer Bürger:** frustriert über Müll, misstrauisch ggü. Behörde, „ändert sich eh nichts". Will Wirkung sehen.
- **Nutzer B — Tourist:** schockiert über Müll an Postkarten-Orten, emotional, teilfreudig, kommt oft über einen **geteilten Link** auf Karte/Report-Detail → diese müssen für Fremde sofort verständlich sein (EN/DE).

**Ton — „Konstruktive Härte":** datengetriebener fairer Schiedsrichter, nicht wütender Aktivist. **Karotte + Peitsche** (handelnde Behörden sichtbar gelobt, untätige sichtbar gerankt). Empowerment statt Resignation („Du bist nicht allein — 14 wollen dasselbe"). Sauber, hell, vertrauenswürdig; klare Dringlichkeit nur dort, wo etwas ignoriert wird. **Kein** Behörden-Portal-Look, **kein** Anprangern von Privatpersonen, **kein** graues Beschwerdeformular.

---

## 5. Design System (from scratch, geo-neutral)

### Farbpalette — „Morning Freshness" (Marke Drosia; Details im Brand-Konzept)
- **Logo/Bildmarke:** **Tropfen als Karten-Pin** — δροσιά = Tau + Ort/Meldung in *einem* Zeichen; optional ein freundliches Tropfen-Maskottchen „Σταγόνα" für Sticker/Schulkampagnen.
- **Primary — frisches Aqua/Teal** (`#00B4C8`-Richtung): Marke, Header, primäre Aktionen. **Nicht** Ägäis-Blau.
- **Accent — Morgenlicht/Zitrus** (`#FFC247`-Richtung), sparsam: Energie/Optimismus, Hervorhebungen.
- **Action / Success — Mint/Frischgrün** (`#2ECC71`-Richtung): behobene Reports, Champion-Behörden, „behoben"-Bestätigung.
- **Severity-Skala (zentral):** durchgängiger Verlauf „wie lange ignoriert": 🟢 frisch (<7 T) → 🟡 (<30) → 🟠 (<60) → 🔴 (>60). Erscheint überall (Counter, Map-Pins, Top-Listen).
- **Neutral/Surface:** helle Off-Whites, Trennlinien. **Text:** Primär/Sekundär/Disabled, hoher Kontrast (ältere Smartphones).
- **Dark-Mode** von Anfang an mitdenken.

### Typografie
- Body ≥ 16px; Titel groß/bold. **Zahlen prominent & tabular** (Counter, Votes, Tage-offen) — Zahlen sind das emotionale Zentrum. Schrift muss **griechische + lateinische (inkl. Diakritika)** sauber rendern.

### Komponenten (alle neu, wiederverwendbare Specs)
Basis: Primär-/Action-Button, Kategorie-Chips mit Emoji-Icon, Card, 4-Schritt-Step-Dots, Foto-Thumbnails, Map-Pins, Leaderboard-Zeile mit Fortschrittsbalken, Status-Badge, **skalierbarer Sprach-/Regions-Umschalter**.
Kern-Mechanik:
- **VoteButton / „Ich auch"** — großer Tap-Target, Live-Zähler, Optimistic UI; zwei Varianten: **👍 Wichtig/+1** (treibt Ranking) und **🔴 Ist noch da** (Verifikation + frischer Zeitstempel); Social-Proof-Text („**14** wollen, dass das behoben wird").
- **SeverityCounter** — „⏱️ Offen seit **47 Tagen**", eingefärbt; bei Lösung „eingefroren" („Behoben nach 12 Tagen ✅").
- **ConfirmResolved** — „✅ Sieht erledigt aus" → Crowd-Verifikation, optional Foto-Beweis.
- **StatusTimeline** — Gemeldet → Weitergeleitet → Behoben, je Schritt mit Datum.
- **ShareCard** — teilbares Bild: **auto-anonymisiertes** Foto + Mini-Karte + Tage-Counter + Behörden-Tag + Drosia-Branding; Share-Sheet (WhatsApp, Viber, Facebook, X, LinkedIn, Link).
- **ImpactCard / BadgeChip**, **ShockStat** (überdimensionale aggregierte Zahl), **PushFollow-Prompt** (Web-Push, 3 Zustände, kein E-Mail-Feld), **Mein-Impact-Link**.

---

## 6. Screens — priorisiert

> **Feindetail zum Kickoff-Set (Public 1, 3, 9 + Admin A3):** `DROSIA-SCREEN-SPECS-KICKOFF-2026-06-23.md` — layoutgenaue Specs mit Daten-Bindung ans Schema, States, Interaktionen und Copy (EL/EN/DE bzw. EN). Weitere Screens dort auf Zuruf in gleicher Tiefe.

1. **Report-Detail / Tracking `/r/<token>` (HÖCHSTE):** Landeseite geteilter Links, hier entsteht Druck. Großes anonymisiertes Foto, Kategorie, Behörde; **SeverityCounter** oben; VoteButton + „Ist noch da" mit Live-Zahlen; StatusTimeline; **Share-Bereich** prominent; „✅ Sieht erledigt aus" + „🔔 Verfolgen" (Web-Push); „In der Nähe" 2–3 Reports; bei `resolved`: Vorher/Nachher + Feier.
2. **Karte (HÖCHSTE):** Vollbild, Pins nach Severity, Cluster; Filter Status/Kategorie/„in meiner Nähe"/Behörden-Suche; Pin-Tap → Vorschau-Card; Toggle Pins↔Heatmap; Empty State mit Sog („Noch keine Meldungen in [Ort] — sei die/der Erste").
3. **Melden-Flow (HÖCHSTE — Kernfunktion):** 4 Schritte (Foto → Standort bestätigen → Kategorie/Details → senden). Foto-Upload mit echtem Fortschritt; Standort Foto-GPS→Live-GPS→Pin; Kategorie-Chips; **Upload-Einwilligung** (Checkbox: keine erkennbaren Personen, Rechte am Foto, Zustimmung Weiterleitung). Maximal schnell, kein Konto.
4. **Success-Screen nach dem Melden (HOCH — Wachstums-Moment):** „✅ Deine Meldung ist raus!" + Tracking-Link; **ShareCard prominent**; „🔔 Verfolgen" (Web-Push); „4 weitere offene Reports in der Nähe" → Sog zur Karte; „Zum Homescreen hinzufügen" (PWA).
5. **Top-Liste „Die dringendsten" (HOCH):** Ranking nach Votes/Bestätigungen; Zeile = anonym. Foto, Vote-Zahl, Tage-Counter, Behörde, Status, Share; Filter-Tabs „In meiner Nähe / Meine Region / Landesweit".
6. **Landing/Startseite (MITTEL):** **ShockStat-Hero** („Behörden haben Reports zusammen **4.812 Tage** ignoriert"); Vorher/Nachher-Galerie behobener Fälle; Top-Liste-Teaser + Behörden-Leaderboard.
7. **Behörden-Scorecard (MITTEL):** Detailseite je Behörde: Lösungsquote, ⌀ Reaktionszeit, offene/behobene Reports, Rang, Verlauf — **als teilbare Karte** (Druck-Asset). Fairness-Hinweis: nur zugestellte Reports, Disclaimer.
8. **„Mein Impact" (MITTEL — Stickiness):** gerätegebundene Bilanz („7 gemeldet · 3 behoben · 120 Bestätigungen"), BadgeChips, „meine Meldungen", Mein-Impact-Link.
9. **ShareCard-Artefakt / OG-Image (HOCH):** das Vorschaubild beim Teilen; 3 Varianten — **neuer Report**, **ignoriert seit X Tagen** (Druck), **behoben 🎉** (Feier).

---

## 6b. Admin-Board-Screens (Operator-Tool — Desktop-first, ausschließlich Englisch)

Das **interne Board** zum Verifizieren, Sichten, Online-Schalten und automatischen Benachrichtigen der Gemeinden. **Bewusst anders als die Public-App:** Desktop-first, dicht/funktional/schnell, **komplett auf Englisch** (für künftige internationale Mitarbeitende), kein emotionales Consumer-UI. Gleiche Drosia-Farben, aber utilitaristisch (Tabellen, Filter, dichte Zeilen, Status-Pills). Eigene Komponenten: DataTable, FilterBar, Detail-Panel, StatusPill, AuditLog. Vollständige Fachspez: `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md`.

- **A1 — Login:** schlicht, Passwort (kein öffentliches Konto-System); Drosia-Logo; Englisch.
- **A2 — Moderation Queue:** Tabelle der `submitted`-Reports — Spalten: anonymisiertes Thumbnail, Category, auto-zugeordnete Authority, Location, Age, Votes; Filter (status/authority/age); Klick → A3. Empty State: „No reports awaiting moderation."
- **A3 — Report Moderation Detail (Kern):** großes **anonymisiertes** Foto + bewusst gegateter Toggle „View original (verification only)"; auto-zugeordnete Authority (editierbar), Location-Karte, Category (editierbar), Description; **Primäraktion „Approve & send"** (löst die Auto-Mail an die Gemeinde aus) mit **E-Mail-Vorschau** (Empfänger, Sprache = Sprache der Gemeinde, Link zum Report); „Reject" mit Gründen (inkl. „shows private person/property"); Anonymisierungs-Status sichtbar.
- **A4 — Authority Directory:** Tabelle der Behörden — Name, Level, Email, Delivery channel, Coverage, Pending count; **„Missing email"-Ansicht** (nach Pending sortiert); Bounce-Status; CRUD; Coverage-Karte.
- **A5 — Delivery & Bounce Monitor:** Sende-Log je Report — Recipient, Status (sent/delivered/bounced/failed/complained), Timestamp, **„Resend"**; Filter nach Status; Bounces/Complaints prominent.
- **A6 — Flags & Disputes:** Queue der `content_flags` (DSA Notice-and-Takedown) + `authority_responses` (disputed/not responsible); Resolve/Remove; Audit-Trail.

Design-Ton Admin: klar, ruhig, hohe Informationsdichte, **eine eindeutige Primäraktion je Screen**; Status farbcodiert (Severity-/Success-Palette wiederverwenden). Je Screen Normal-State + relevanter Edge-State (leere Queue, Bounce-Fall, fehlende Behörden-Email).

---

## 7. Empty / Error / Loading
- **Empty:** Karte ohne Reports → einladender Sog; „Mein Impact" leer → „Deine erste Meldung verändert etwas."
- **Error:** Standort nicht gefunden, Bild zu groß, offline → klare, menschliche, **lokalisierte** Hinweise mit Retry (keine technischen Codes).
- **Loading:** Foto-Upload echter Fortschritt; Karte Skeleton; Votes/Counter Optimistic UI.

## 8. Micro-Interactions
Vote-Tap (sofort hochzählen + Bounce), SeverityCounter (tickt, Farbwechsel an Schwellen), Resolved-Feier (Konfetti + Vorher/Nachher-Wisch), Share (1 Tap → Share-Sheet), ShockStat (zählt beim Laden hoch).

## 9. Navigation (Bottom-Tab, Mobile)
```
[Karte]     [Dringendste]     [Melden]      [Mein Impact]
 (Pin)       (Flamme/Top)     (Kamera, +)    (Profil)
```
„Melden" als hervorgehobener zentraler Button. Sprach-/Regions-Umschalter leicht erreichbar.

---

## 10. Sprache & Recht (Design-relevant)
- Alle UI-Texte über i18n; Start EL/EN/DE, erweiterbar. Griechische CTAs z. B. „Κάνε αναφορά", „Είναι ακόμα εκεί", „Φαίνεται καθαρό", „Κοινοποίησε".
- **Faktentreue** Auto-/Share-Texte (nur Zahlen/Status, keine Beleidigung) — rechtlicher Schutz.
- **Anonymisierung ist Pflicht:** In **allen** öffentlichen/teilbaren Ansichten werden **Gesichter & Kfz-Kennzeichen verpixelt** gezeigt — im Design *immer* die verpixelte Variante darstellen (rechtlicher Blocker, siehe Launch-Readiness-Punchliste).
- **Admin-Board = ausschließlich Englisch** (nicht Teil des Public-i18n), für künftige internationale Mitarbeitende. **Abgrenzung:** der ausgehende **Behörden-Mailtext** bleibt in der Sprache der Gemeinde (z. B. Griechisch) — Englisch betrifft nur die Bedienoberfläche.

## 11. Was ausdrücklich NICHT designed wird
Kein Login/Registrierung/**E-Mail-Feld**; kein UI, das ein dauerhaftes/geräteübergreifendes Konto suggeriert; keine Bezahl-Screens; **kein Anprangern von Privatpersonen/Grundstücken** (nur Behörden-Accounts/Institutionen); keine unverpixelten Fotos.

---

## 12. Tech-Kontext (für konsistente Specs; Code kommt in separatem Briefing)
Geplanter sauberer Rebuild-Stack: **Next.js 16 / React 19 / TypeScript strict / Supabase (PostgreSQL + PostGIS + Storage) / Resend / Tailwind**, **PWA ab Tag 1**. Design daher: komponentenbasiert, Tailwind-freundliche Tokens (Spacing/Radii/Farben als Variablen), Mobile-first 375px Basis, Touch-Targets ≥ 44px. Datenmodell-Andeutung fürs UI: Report (Foto[n], Kategorie, Geo, zuständige Behörde, Status submitted→notified→resolved, Votes, Bestätigungen, Tage-Counter), Behörde (Name lokalisiert, Region, Kontakt), alles **mehr-jurisdiktionsfähig**.

## 13. Output-Erwartung
1. **Design-System:** Farben (inkl. Severity-Skala, Light+Dark), Typografie, alle Komponenten als wiederverwendbare Specs.
2. **Die 9 priorisierten Screens** in Mobile (375px), je Normal-State + mind. 1 Edge-State (Empty/Error/Loading/Resolved).
3. **Die 3 ShareCard-Varianten** als eigene Artefakte.
4. **User-Flow-Diagramm:** geteilter Link → Report-Detail → Vote/Share/Follow → Wiederkehr; sowie Melden-Flow.
5. **Sprach-/Regions-Umschalter** als skalierbare Komponente (EU-ready).
6. **Die 6 Admin-Board-Screens** (Abschnitt 6b) als eigenes Set — **Desktop, Englisch**, funktional/dicht, klar abgesetzt von der Public-App; je Screen Normal- + relevanter Edge-State.

**Reihenfolge:** Beginne mit der Public-App — Screen 1 (Report-Detail/Tracking), Screen 3 (Melden-Flow) und Screen 9 (ShareCard), die Kernfunktion, Druck-Mechanik und Wachstum tragen. Das **Admin-Board (6b)** danach als eigener, in sich geschlossener Block.
