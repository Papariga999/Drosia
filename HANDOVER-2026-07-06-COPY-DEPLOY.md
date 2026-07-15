# Übergabe → Claude Code: Partner-/Support-Copy committen & deployen

**Ziel:** Die neue, lockerere Partner-/Support-Copy (EN/DE/EL) live bringen — **ohne** den übrigen, noch unfertigen Arbeitsstand mitzudeployen.

**Wichtig:** Nur die drei i18n-Dateien sollen in diesen Commit. Der restliche Working Tree (Security-/Refactor-WIP: `proxy.ts`, `lib/http-body.ts`, `lib/image-upload.ts`, `lib/webhooks/`, `lib/admin/request-origin.ts`, neue Tests etc.) bleibt uncommittet und wird **nicht** ausgeliefert.

---

## 0. Ausgangslage

- Bereits erledigt: In `lib/i18n/en.json`, `lib/i18n/el.json`, `lib/i18n/de.json` sind die Blöcke `landing.partner*` und `support.*` neu getextet (wärmer, jung, „du", CTA „Get in touch / Kontaktier uns / Επικοινώνησε μαζί μας"; Formular-Button „Send it / Abschicken / Στείλ' το"). Diese Änderungen sind **uncommittet**.
- Keys sind unverändert → i18n-Parität bleibt. JSON wurde als valide geprüft.
- Volltext-Referenz (falls du Werte gegenchecken/wiederherstellen willst): `DROSIA-SUPPORT-COPY-2026-07-06.md` (im Cowork-Projektordner „Anti Glaze Prompt").
- Vercel: Projekt `drosia` (`prj_002qwKYDWlOgzLxyt4JZZAeUrNrB`, Team `team_mwr75aCxw1CNAAgSCwVkeujT`), Git-Remote `origin` = `https://github.com/Papariga999/Drosia.git`, Branch `main`. Push auf `main` → Vercel deployt automatisch.

---

## 1. Schritte (in dieser Reihenfolge)

```bash
cd C:\Users\salva\projects\Drosia

# a) Falls eine abgebrochene Git-Operation blockiert:
#    (nur ausführen, wenn git über einen bestehenden Lock meckert)
# del .git\index.lock        # PowerShell/CMD
# rm -f .git/index.lock       # Git-Bash

# b) Genau prüfen, was sich in den drei Dateien geändert hat
git diff -- lib/i18n/en.json lib/i18n/el.json lib/i18n/de.json

# c) Gates laufen lassen (nur um sicherzugehen, dass nichts kaputt ist)
npm run typecheck
npm run test -- i18n-parity

# d) NUR die drei i18n-Dateien stagen und committen
git add lib/i18n/en.json lib/i18n/el.json lib/i18n/de.json
git status --short        # Kontrolle: es dürfen NUR die 3 JSONs "grün" sein
git commit -m "copy: warmer, younger partner + support wording (EN/DE/EL)"

# e) Pushen → Vercel deployt main automatisch
git push origin main
```

**Nicht** `git add -A` / `git add .` benutzen — das würde den ganzen WIP mitnehmen.

---

## 2. Verifikation nach dem Deploy

1. Vercel-Dashboard → Projekt `drosia` → Deployments: neuer Build zum eben gepushten Commit sollte „Ready" werden.
2. Live prüfen (drosia.vercel.app bzw. drosia.eu):
   - Startseite, Block „Supporters": Kicker „Let's team up" / „Lass uns zusammen" / „Έλα στην παρέα", CTA-Button „Get in touch / Kontaktier uns / Επικοινώνησε μαζί μας".
   - `/support`: Hero-Headline „Good intentions don't pick up litter." / „Gute Absichten räumen keinen Müll weg." / „Οι καλές προθέσεις δεν μαζεύουν σκουπίδια."; Formular-Button „Send it / Abschicken / Στείλ' το".
   - Sprache umschalten (EL/EN/DE) und je Sprache gegenchecken.

---

## 3. Falls „deployt nicht" — Fehlersuche

Häufigste Ursachen, der Reihe nach:

1. **Nichts committet/gepusht.** `git log origin/main -1` — zeigt es den neuen Copy-Commit? Wenn nicht, war Push nicht erfolgreich (Auth/Remote prüfen: `git remote -v`, `git push origin main`).
2. **Vercel-Git-Integration getrennt/pausiert.** Dashboard → Project → Settings → Git: ist das GitHub-Repo verbunden und Auto-Deploy für `main` aktiv? Ggf. „Redeploy" manuell auslösen.
3. **Build schlägt fehl.** Dashboard → Deployments → fehlgeschlagenen Build öffnen → Build Logs. Häufig: TypeScript-/Lint-Fehler aus **anderem** (versehentlich mitgecommittetem) Code. Deshalb Schritt 1d strikt auf die 3 JSONs begrenzen. Bei rotem Build: Logs lesen, Fehler fixen, erneut pushen. (Solange der Build rot ist, bleibt die letzte grüne Version live — Produktion ist also nicht kaputt.)
4. **Falscher Branch.** Prüfen, ob Vercel „Production Branch" = `main` ist (Settings → Git → Production Branch).
5. **Cache/CDN.** Nach „Ready" hart neu laden (Strg/Cmd+Shift+R); die App rendert per-request, aber Assets können gecacht sein.

---

## 4. Optional danach

- Wenn der WIP (Security-/Refactor-Pass) fertig ist: separat committen + pushen, dann getrennt deployen — sauber getrennt von der Copy.
- Web-Push scharf schalten (noch offen aus früherem Handover): `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in Vercel setzen und `report_follows`-Migration anwenden. Details: `HANDOVER-2026-07-06-SITE-REVIEW-TODOS.md` (WO-1).
