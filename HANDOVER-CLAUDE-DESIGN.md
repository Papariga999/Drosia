# Handover → Claude Design

> **Paste this as the opening prompt for Claude Design.** It is self-contained (you can start immediately from what's inline). For full depth, read the three reference files listed below — they live in this folder `C:\Users\salva\projects\Drosia`.

---

## Your task
Design **Drosia** — a login-free civic web app — as a production-ready **UI design system + all screens, from scratch**. Do not reuse any old "GreeceClean/Katharos" UI.

## What Drosia does (in 3 lines)
Citizens & tourists report litter / illegal dumping / environmental issues in **under 60 seconds, no account**. The report is routed to the **responsible authority** (PostGIS), and after moderation an email is **auto-sent to that authority with a link to the report**. Every report gets a public tracking page, a map, and a public **authority accountability scorecard**. **Launch: Greece (one island region). Architecture & brand: EU-ready from day one** (nothing hardcoded to "Greece").

## Reference files (this folder — read for full detail)
1. **`BRIEFING-CLAUDE-DESIGN-CleanRebuild-EUready-2026-06-23.md`** — full design briefing: design system, principles, all 15 screens (overview).
2. **`DROSIA-SCREEN-SPECS-KICKOFF-2026-06-23.md`** — layout-precise specs for all 15 screens: regions, data bindings, states, interactions, copy.
3. **`DROSIA-BRAND-KONZEPT-2026-06-23.md`** — brand world: palette, logo, claim, tone. (Operator detail: `DROSIA-ADMIN-BOARD-SPEC-2026-06-23.md`.)

## Brand essentials (inline, so you can start now)
- **Name:** Drosia (Greek δροσιά = the cool freshness of morning dew). **Claim**, localized: EN "Keep it fresh & clean." · EL "Δώσε ξανά δροσιά στον τόπο σου." · DE "Halt deinen Ort frisch und sauber."
- **Palette "Morning Freshness"** (geo-neutral, NOT Aegean blue): primary aqua `#00B4C8`, success/mint `#2ECC71`, accent/citrus `#FFC247`, surface `#F7FBFC`; **severity scale** (central): fresh `#2ECC71` → `#F4D03F` → `#E67E22` → stale `#E74C3C`. Dark mode from the start.
- **Logo:** a **dewdrop whose tip doubles as a map-pin** (freshness + location/report in one mark). Optional friendly dewdrop mascot ("Σταγόνα") for stickers/schools.
- **Tone — "constructive firmness":** positive & fresh on the surface, factual & calm in the data. Never angry, never a grey complaint form, never a cold government portal. **Numbers are the emotional center** — large, `tabular-nums`.

## Two surfaces (designed differently)
- **A) Public app:** mobile-first (375px base), **multilingual** (EL/EN/DE, built to add FR/IT/ES/HR…), **anonymous & login-free** — identity is an invisible device token; **no email field anywhere**; return via Web-Push only. PWA-installable.
- **B) Admin board:** **desktop-first, ENGLISH-ONLY** (for future international staff), dense/functional operator tool — tables, filters, one clear primary action per screen. *Note: the admin UI is English, but the outgoing authority email stays in the authority's language (e.g. Greek).*

## Hard rules (never violate)
- Public/shareable photos are **always anonymized** (faces + license plates blurred). **Never** show the original.
- **Only institutions** (authority accounts) are tagged — **never** private persons or private property.
- **Accountability is fair by design:** a scorecard/leaderboard appears only with **≥ 10 delivered reports**; below that show "not enough data yet" — **never** a misleading rank, and **never** an empty/fake board on the landing page.
- No login, no account, **no email collection**; no payment/pricing screens.

## Build order
1. **Public Screen 1** — Report-Detail / Tracking `/r/<token>` (where shared links land; pressure mechanic).
2. **Public Screen 3** — Report flow (4 steps, <60s).
3. **Public Screen 9** — ShareCard / OG-image (3 variants: new / ignored X days / resolved 🎉).
4. Then Public 2 (Map), 4 (Success), 5 (Top-list), 6 (Landing), 7 (Authority scorecard), 8 (My impact).
5. Then the Admin board: A1 Login, A2 Moderation Queue, A3 Report-Moderation-Detail, A4 Authority Directory, A5 Delivery & Bounce Monitor, A6 Flags & Disputes.

## Output expected
- **Design system:** colors (incl. severity scale, light + dark), typography, all reusable components.
- **All 15 screens** at the right breakpoint (public = mobile 375px; admin = desktop), each with the normal state **plus** the key edge states (empty / error / loading / resolved).
- **The 3 ShareCard variants** as standalone artifacts (1200×630 OG; optional 1080×1080).
- **User-flow diagram:** shared link → report detail → vote/share/follow → return; plus the report flow.

**Start with Screen 1 (Report-Detail/Tracking) and Screen 9 (ShareCard).**

---

## How to give Claude Design access to this folder
This Cowork session has `C:\Users\salva\projects\Drosia` connected — but that connection does not carry over to Claude Design automatically. To give Claude Design the files:
- **If Claude Design supports connecting a local folder:** connect `C:\Users\salva\projects\Drosia` there (same way you connected it here), then point it at this `HANDOVER-CLAUDE-DESIGN.md`.
- **Otherwise:** paste this file as the prompt and **attach/upload the three reference files** above. The handover is written to work even without folder access (the essentials are inline).
