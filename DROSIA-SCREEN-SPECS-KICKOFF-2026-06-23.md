# Drosia — Detail-Screen-Specs (Kickoff-Set)

**Datum:** 2026-06-23 · **Ergänzt:** `BRIEFING-CLAUDE-DESIGN-CleanRebuild-EUready-2026-06-23.md` (Überblick) + `DROSIA-BRAND-KONZEPT` (Marke).
**Zweck:** Layoutgenaue, designer-fertige Specs für die Screens, mit denen du startest. Jede Spec: Aufbau (oben→unten), Komponenten **mit Daten-Bindung ans echte Schema** (`supabase/schema.sql`), alle States, Interaktionen, Copy (EL/EN/DE für Public; **Englisch** fürs Admin) und A11y. Dieses Dokument deckt **alle 15 Screens** ab — Public 1–9 und Admin A1–A6.

## Gemeinsame Konventionen
- **Marke „Morning Freshness":** Primary Aqua `#00B4C8`, Success/Mint `#2ECC71`, Accent/Zitrus `#FFC247`, Surface `#F7FBFC`. Logo = **Tropfen-als-Karten-Pin**.
- **Severity-Skala** (Alter seit `notified_at ?? created_at`): 🟢 `#2ECC71` <7 T · 🟡 `#F4D03F` <30 · 🟠 `#E67E22` <60 · 🔴 `#E74C3C` >60. Erscheint in Counter, Map-Pin, Karten.
- **Zahlen immer `tabular-nums`** und groß — sie sind das emotionale Zentrum.
- **Public:** mobile-first 375px, Touch-Targets ≥ 44px, mehrsprachig. **Admin:** Desktop ≥ 1280px, dicht, **Englisch**.
- **Foto-Regel:** öffentlich/teilbar **immer** `v_public_report_photos.public_path` (anonymisiert) — **nie** `original_path`.

---

## PUBLIC · Screen 1 — Report-Detail / Tracking `/r/<token>` (HÖCHSTE)

**Zweck:** Landeseite geteilter Links; hier entsteht Druck. Für eine/n fremde/n Touristen **sofort** verständlich.
**Daten-Bindung:** `v_public_reports` (per `public_token`) → `category, lat, lng, status, vote_count, confirm_count, created_at, notified_at, resolved_at, last_confirmed_at`; Foto aus `v_public_report_photos.public_path`; Behördenname aus `authorities.name_i18n[locale]`. Severity berechnet aus Alter.

**Aufbau (oben→unten, mobil):**
1. **App-Bar:** Tropfen-Logo (→ Home), skalierbarer Sprachschalter (EL/EN/DE).
2. **Hero-Foto:** full-width, **anonymisiert**, `rounded-2xl`, 4:3; mehrere Fotos → wischbar. Overlay oben-links Kategorie-Chip (Emoji+Label), oben-rechts Behörden-Tag.
3. **SeverityCounter (prominent, direkt unter Foto):** „⏱ Offen seit **47** Tagen", eingefärbt nach Skala. Bei `resolved` → eingefrorener Erfolgs-State „Behoben nach **12** Tagen ✅" (Mint).
4. **Meta-Zeile:** Kategorie · Behörde · Ort · Meldedatum.
5. **Engagement-Leiste:** **👍 Wichtig** (`vote_count`) + **🔴 Ist noch da** (`confirm_count`) — große Targets, Optimistic UI; Social-Proof darunter „**14** wollen, dass das behoben wird".
6. **StatusTimeline:** Gemeldet → Weitergeleitet → Behoben, je Schritt mit Datum (`created_at/notified_at/resolved_at`), aktueller Schritt hervorgehoben.
7. **Share-Block (prominent):** „Teilen, damit es nicht ignoriert wird" + Share-Sheet (WhatsApp, Viber, Facebook, X, LinkedIn, Link kopieren) → erzeugt ShareCard (Screen 9).
8. **Sekundäraktionen:** „✅ Sieht erledigt aus" (ConfirmResolved, optional Foto) · „🔔 Verfolgen" (Web-Push, 3 Zustände, **kein E-Mail-Feld**).
9. **Mini-Karte:** kleiner Leaflet-Ausschnitt mit Tropfen-Pin (severity-farbig) → Tap = Vollkarte (Screen 2).
10. **„In der Nähe":** 2–3 weitere offene Reports als Karten (`v_public_reports` nach Distanz).
11. **Footer:** Drosia · Datenschutz/Impressum/AGB · **DSA-„melden/beanstanden"-Button** (`content_flags`) — Pflicht an jedem öffentlichen Inhalt.

**States:** *default* (in_review/notified) · *resolved* (Vorher/Nachher-Wisch + einmalige Konfetti-Feier) · *loading* (Skeleton: Fotoblock, Counter, Timeline) · *error* (Token unbekannt → freundliche, lokalisierte 404 „Diese Meldung existiert nicht oder wurde entfernt").
**Interaktionen:** Vote-Tap → sofortiges Hochzählen + Tropfen-Ripple; Counter tickt, Farbwechsel an Schwellen; Share → natives Sheet; Follow → Browser-Permission.
**Copy (Beispiele):** EL „Είναι ακόμα εκεί" · EN „Still here" · DE „Ist noch da". EL „Κοινοποίησε" · EN „Share" · DE „Teilen".
**A11y:** Alt-Text am Foto („anonymisiertes Foto der gemeldeten Verschmutzung, Kategorie X"); Counter als Text (nicht nur Farbe); klare Fokusreihenfolge.

---

## PUBLIC · Screen 3 — Melden-Flow (HÖCHSTE — Kernfunktion)

**Zweck:** Meldung in <60 s, ohne Konto. **Daten-Ziel:** Insert in `reports` (+ `report_photos`) serverseitig; Geofence `ST_Covers(country.boundary, point)`; Behörde via `ST_Contains(authorities.geom, point)`.

**4 Schritte (Step-Dots oben):**
1. **Foto:** großer Kamera/Upload-CTA; bis 3 Fotos; Thumbnails; clientseitige Kompression; **echter** Upload-Fortschritt. Copy „Foto vom Problem".
2. **Standort bestätigen:** auto aus Foto-EXIF → sonst Live-GPS → sonst Pin ziehen. Karte mit ziehbarem Tropfen-Pin; „Stimmt der Ort?". **Außerhalb GR → freundliche Ablehnung** „Drosia deckt aktuell nur Griechenland ab".
3. **Kategorie & Details:** 12 Kategorie-Chips (Emoji); optionale Beschreibung (≤1000, Live-Zähler); **Upload-Einwilligung (Pflicht-Checkbox):** keine erkennbaren Personen / Rechte am Foto / Zustimmung zur Weiterleitung.
4. **Senden/Review:** Zusammenfassung (Foto, Ort, Kategorie, **Behörden-Vorschau** „Wird an Δήμος X gesendet"); Senden-Button; Honeypot (versteckt).

**States:** Schritt-Validierung; Upload-Fortschritt; *error* (Bild zu groß 413, Standort nicht gefunden, offline, Rate-Limit 429 → freundlich); *success* → Übergang zu Success-Screen (Screen 4).
**Design:** ein klarer Primär-Button je Schritt; Zurück möglich; nichts blockiert außer Pflicht-Einwilligung.
**Copy:** EL „Κάνε αναφορά" · EN „Report" · DE „Melden".

---

## PUBLIC · Screen 9 — ShareCard / OG-Image (HOCH)

**Zweck:** das Bild, das sich verbreitet (FB/X/WhatsApp/Viber/IG). Serverseitig generiert (OG-Route), **immer anonymisiert**, gebunden an Report-Daten.
**Format:** 1200×630 (OG) + optional 1080×1080 (IG/Stories).
**Komposition:** anonymisiertes Foto (Hintergrund/links), Tropfen-Logo, **großer Tage-Counter** (tabular), Behörden-Tag, Kategorie, Mini-Karten-Punkt; „Morning Freshness"-Palette.
**3 Varianten:**
- **Neu gemeldet** (Aqua, neutral) — „Neu gemeldet · heute".
- **Ignoriert seit X Tagen** (severity-farbig, Druck) — riesiges „**47** Tage ignoriert" in Stale-Rot.
- **Behoben 🎉** (Mint, Feier) — Vorher/Nachher-Split + „Behoben nach **12** Tagen".
**Regeln:** nie Originalfoto; Textoverlays lokalisiert; faktentreu (nur Zahlen/Status).

---

## ADMIN · A3 — Report-Moderation-Detail (Operator-Kern) — **ENGLISH ONLY, Desktop**

**Zweck:** verify → sight → **approve → auto-email** to the municipality. This is the legal liability surface, so anonymization + "document trash, not perpetrators" are enforced here.
**Daten-Bindung:** `reports` (full row, service-role), `report_photos` (`original_path` via signed URL, `public_path`, `blur_status`), auto-matched `authorities` row, `delivery_logs`, `authority_responses`.

**Layout (Desktop, 2 Spalten):**
- **Left (media):** large **anonymized** photo (`public_path`); **gated toggle „View original (verification only)"** → signed URL to `original_path`, access logged; `blur_status` badge (pending / done / failed).
- **Right (data + actions):**
  - **Report meta:** `public_token`, category (editable), description, submitted-at, `author_token` (masked), locale.
  - **Auto-matched authority** (from `ST_Contains`): name, level, `email_official` — or **⚠ "No email — will hold as 'awaiting authority email'"**; `delivery_channel`; **reassign** possible.
  - **Location map** (Leaflet: the point + the authority polygon overlay).
  - **Primary action „Approve & send"** → `in_review`→`notified`, triggers `deliverReport`. Opens an **email preview modal**: recipient, subject, **language = authority locale (NOT English)**, body incl. **link to `/r/<token>`** → confirm. Disabled while `blur_status != 'done'` (tooltip "Awaiting anonymization").
  - **Reject** (dropdown reasons): "Shows private person/property", "Spam/invalid", "Out of scope" → `rejected`.
  - **Edit:** category / authority / description.
- **Side panel:** delivery log (StatusPills: queued/sent/delivered/**bounced**/failed/complained + **Resend**); audit trail of admin actions.

**States:** *awaiting-blur* (approve disabled) · *no-authority-email* (approve → holds `in_review`, flagged) · *published* (read-mostly + live delivery status) · *bounced* (delivery panel highlights).
**Tone/efficiency:** English throughout; dense; **one clear primary action**; keyboard shortcuts (approve / reject / next).

---

## PUBLIC · Screen 2 — Karte (HÖCHSTE)

**Zweck:** die emotionale Heimat der App; räumlicher Überblick. **Daten:** `v_public_reports` (`lat,lng,status,category,vote_count`), geclustert; Severity aus Alter.
**Aufbau:** Vollbild-Leaflet; oben Suche (Behörde/Ort) + Filter-Chips (Status/Kategorie/„in meiner Nähe"); **Pins = Tropfen, severity-farbig**; Cluster-Bubbles beim Rauszoomen; **FAB „Melden"** (Kamera). Pin-Tap → Bottom-Sheet-Vorschau (Foto-Thumb, Kategorie, SeverityCounter, Votes, „Details" → Screen 1). Toggle **Pins ↔ Heatmap** (Dichte); „Mich orten".
**States:** *loading* (Tile-Skeleton); *empty-per-area* („Noch keine Meldungen in [Ort] — sei die/der Erste" + Melden-CTA); *error* (Geolocation verweigert → Fallback Landesansicht, kein harter Block).
**A11y:** Listen-Fallback = Top-Liste (Screen 5); Tastatur-Pan.

## PUBLIC · Screen 4 — Success nach dem Melden (HOCH — Wachstums-Moment)

**Zweck:** aus dem Submit Teilen + Wiederkehr machen. **Daten:** der eben erzeugte Report (Token).
**Aufbau:** großes „✅ Deine Meldung ist raus!" + Tropfen-Animation; Tracking-Link (kopieren); **ShareCard prominent** („Teile, damit es nicht ignoriert wird"); „🔔 Verfolgen" (Web-Push, **kein E-Mail-Feld**); „4 weitere offene Reports in der Nähe" → Karte; dezenter „Zum Homescreen hinzufügen" (PWA).
**States:** *default*; *push-blockiert* (sanfter Hinweis); *offline-queued* (falls zutreffend).
**Copy:** EL „Η αναφορά σου εστάλη!" · EN „Your report is in!" · DE „Deine Meldung ist raus!".

## PUBLIC · Screen 5 — Top-Liste „Die dringendsten" (HOCH)

**Zweck:** gerankte Dringlichkeit; teilbar; zugleich die screenreader-freundliche Listenansicht der Karte. **Daten:** `v_public_reports` sortiert nach `vote_count`/`confirm_count`/Alter; Filter-Tabs „In meiner Nähe / Meine Region / Landesweit" + Zeitraum.
**Aufbau:** Listenzeilen: anonym. Thumb · Kategorie · 👍 `vote_count` · Tage-Counter (severity) · Behörde · Status-Badge · Share-Icon. Zeile → Screen 1. Header-Tabs + Sortierung.
**States:** Skeleton-Zeilen; *empty* („Noch keine offenen Meldungen in deiner Region"); *error*.
**A11y:** semantische Liste, sortierbar.

## PUBLIC · Screen 6 — Landing / Startseite (MITTEL)

**Zweck:** erster Eindruck für organische/Presse-Besucher; vermittelt die Accountability-Mission. **Daten:** berechnete Aggregate (ohne `is_test`), `v_authority_scorecard` (Champions + Room-for-Improvement), Vorher/Nachher-Galerie.
**Aufbau:**
- **Hero:** Tropfen-Logo + lokalisierter Claim; Primär-CTA „Melden" + sekundär „Karte ansehen".
- **ShockStat-Hero:** „Behörden haben Reports zusammen **4.812** Tage ignoriert" (zählt beim Laden hoch).
- **So funktioniert's** (3 Schritte: Foto → Senden → Verfolgen).
- **Vorher/Nachher-Galerie** behobener Fälle („Das haben wir gemeinsam erreicht").
- **Leaderboard** (Champions / Room-for-Improvement) aus `v_authority_scorecard` **+ Fairness-Disclaimer** („nur zugestellte Reports, mind. 10").
- Footer (Datenschutz/Impressum/AGB, Partner).
**States — wichtig (Anti-Pattern-Schutz):** Wenn noch **keine** Behörde die Fairness-Schwelle (n≥10) erreicht, ist `v_authority_scorecard` leer → **kein** Fake-/Leer-Board zeigen, stattdessen Mission + CTA. (Verhindert den alten „100 % bei n=1 / Berlin im Board"-Fehler auf Design-Ebene.) *loading*-Skeleton.
**Copy:** EL/EN/DE.

## PUBLIC · Screen 7 — Behörden-Scorecard (MITTEL)

**Zweck:** Accountability-Seite je Behörde; teilbares Druck-Asset. **Daten:** `v_authority_scorecard` (`notified_count, resolved_count, resolution_rate_pct`) + öffentliche Reports dieser Behörde; ggf. `authority_responses`.
**Aufbau:** Header (Name/Level/Region); große **Lösungsquote** (tabular, severity-/success-farbig); ⌀ Reaktionszeit; offen vs. behoben; Rang; Trend-Sparkline. **Fairness-Block:** Disclaimer „beruht auf zugestellten Bürgermeldungen, keine behördliche Feststellung; die Gemeinde kann widersprechen" + ggf. Dispute-Notiz. Teilbare OG-Karte. Liste der Reports dieser Behörde.
**States — Pflicht:** *not-ranked* (`notified_count < 10`) → **keine** irreführende Zahl, sondern „Noch nicht genug Daten für ein faires Ranking (mind. 10 zugestellte Meldungen)". *loading*; *disputed* (Bestreitungs-Hinweis sichtbar).
**Copy:** EL/EN/DE.

## PUBLIC · Screen 8 — Mein Impact `/me/<token>` (MITTEL — Stickiness)

**Zweck:** gerätegebundene persönliche Bilanz, **ehrlich gelabelt**. **Daten:** nach `author_token`: gemeldet/behoben/erhaltene Bestätigungen; Badges.
**Aufbau:** Header **„Impact dieses Geräts"** (nicht „dein Konto"); Stats (z. B. „7 gemeldet · 3 behoben · 120 Bestätigungen", tabular); **BadgeChips** (Erstmelder, Stadtwächter, Saubermacher) mit Fortschritt; Liste „meine Meldungen" mit Status; Bookmark-Hinweis „Lesezeichen setzen, um deinen Impact wiederzufinden" (Token-URL); optional Nachbarschafts-Liga-Teaser.
**States:** *empty* („Deine erste Meldung verändert etwas" + Melden-CTA); *loading*.
**Hinweis:** kein Login/E-Mail; Gerätebindung klar kommunizieren. **Copy:** EL/EN/DE.

---

## ADMIN · A1 — Login (**English**, Desktop)
**Zweck:** Operator-Auth (Passwort + HMAC-Cookie, kein öffentliches Konto-System).
**Aufbau:** zentrierte Card, Drosia-Logo, Passwortfeld, „Sign in"; minimal.
**States:** *default*; *error* („Incorrect password" — kein User-Enumeration); *loading*. **Security:** Rate-Limit. **Copy:** Englisch.

## ADMIN · A2 — Moderation Queue (**English**, Desktop)
**Zweck:** Triage der eingehenden Meldungen. **Daten:** `reports` mit `status='submitted'` (Service-Role).
**Aufbau:** dichte **DataTable** (Spalten: anonym. Thumbnail, Category, auto-matched Authority, Location, Age, Votes, Blur status); **FilterBar** (status/authority/age/blur); Sort; Row → A3; Count-Badge; Sidebar-Nav zu den anderen Admin-Screens.
**States:** *empty* („No reports awaiting moderation"); *loading*; Blur-pending-Zeilen markiert (noch nicht freigebbar). **Copy:** Englisch.

## ADMIN · A4 — Authority Directory (**English**, Desktop)
**Zweck:** Gemeinde-Verzeichnis + E-Mails pflegen. **Daten:** `authorities` + Pending-Count je Behörde + Bounce-Status aus `delivery_logs`.
**Aufbau:** DataTable (Name, Level, Country, Email, Delivery channel, Coverage, Pending count, Last delivery status); **„Missing email"-Ansicht** (Filter, nach Pending sortiert); CRUD (Authority anlegen/bearbeiten: `name_i18n`, `geom` zeichnen/hochladen, Email, Channel); Bounce-Flags; Coverage-Karte.
**States:** missing-email hervorgehoben; bounce hervorgehoben; *empty*; *loading*. **Copy:** Englisch.

## ADMIN · A5 — Delivery & Bounce Monitor (**English**, Desktop)
**Zweck:** Zustell-Gesundheit überwachen. **Daten:** `delivery_logs` ⋈ `reports`/`authorities`.
**Aufbau:** DataTable (Report token, Authority, Recipient, Channel, **Status-Pill** queued/sent/delivered/bounced/failed/complained, Timestamp, provider_message_id, Error); Filter nach Status; **„Resend"** je Zeile; oben Aggregat-Health (Bounce-Rate, % delivered); **Warnbanner**, wenn `EMAIL_FROM`-Domain nicht verifiziert (Startup-Check).
**States:** bounce/complaint hervorgehoben; *empty*; *loading*. **Copy:** Englisch.

## ADMIN · A6 — Flags & Disputes (**English**, Desktop)
**Zweck:** DSA-Notice-and-Takedown + Behörden-Einwände. **Daten:** `content_flags` (open/actioned/dismissed) + `authority_responses` (disputed/not_responsible/in_progress/resolved).
**Aufbau:** zwei Queues/Tabs — **Flags** (Report-Link, Reason, reporter_contact, Status; Aktionen: Remove content / Dismiss) und **Disputes** (Report, Authority, response_type, Note; Aktionen: Acknowledge / als `excluded_from_ranking` markieren); Audit-Trail.
**States:** *empty*; *loading*; dringende Flags hervorgehoben. **Copy:** Englisch.

---

**Vollständig:** Alle 15 Screens (Public 1–9, Admin A1–A6) sind spezifiziert. Übergabe an Claude Design mit: diesem Dokument + Design-Briefing + Brand-Konzept.
