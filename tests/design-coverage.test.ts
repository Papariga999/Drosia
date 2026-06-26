import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const designRoot = join(root, "Design", "Drosia-Projektdokumentation");
// The design handoff assets are gitignored (large reference HTML/PNG), so they
// may be absent on a fresh clone / in CI. When present we also assert the design
// file exists; the implementation-coverage check always runs.
const hasDesignAssets = existsSync(designRoot);

const designCoverage = [
  {
    design: "Drosia Design System.dc.html",
    implementation: ["app/globals.css", "tailwind.config.ts", "components/brand/Logo.tsx"],
  },
  {
    design: "Drosia Dark Mode.dc.html",
    implementation: ["app/globals.css", "components/ui/ThemeToggle.tsx"],
  },
  {
    design: "Drosia Screen 1 - Tracking (final).dc.html",
    implementation: [
      "app/(public)/r/[token]/page.tsx",
      "app/(public)/r/[token]/loading.tsx",
      "app/(public)/r/[token]/not-found.tsx",
      "components/screens/TrackingScreen.tsx",
    ],
  },
  {
    design: "Drosia Screen 2 - Karte.dc.html",
    implementation: ["app/(public)/map/page.tsx", "components/screens/MapScreen.tsx"],
  },
  {
    design: "Drosia Screen 3+4 - Melden-Flow.dc.html",
    implementation: ["app/(public)/report/page.tsx", "components/screens/ReportFlow.tsx"],
  },
  {
    design: "Drosia Screen 5 - Top-Liste.dc.html",
    implementation: ["app/(public)/urgent/page.tsx", "components/screens/ListScreen.tsx"],
  },
  {
    design: "Drosia Screen 6 - Landing.dc.html",
    implementation: ["app/(public)/page.tsx", "components/screens/LandingScreen.tsx"],
  },
  {
    design: "Drosia Screen 7 - Behörden-Scorecard.dc.html",
    implementation: ["app/(public)/authority/[slug]/page.tsx", "components/screens/ScorecardScreen.tsx"],
  },
  {
    design: "Drosia Screen 8 - Mein Impact.dc.html",
    implementation: [
      "app/(public)/me/page.tsx",
      "app/(public)/me/[token]/page.tsx",
      "components/screens/ImpactScreen.tsx",
    ],
  },
  {
    design: "Drosia Screen 9 - ShareCard.dc.html",
    implementation: [
      "app/(public)/share-card/page.tsx",
      "app/(public)/r/[token]/opengraph-image.tsx",
      "components/screens/ShareCard.tsx",
    ],
  },
  {
    design: "Drosia Admin Board.dc.html",
    implementation: ["app/admin/page.tsx", "components/admin/AdminBoard.tsx"],
  },
];

describe("design artifact coverage", () => {
  it.each(designCoverage)("$design has a corresponding route/component scaffold", ({ design, implementation }) => {
    if (hasDesignAssets) {
      expect(existsSync(join(designRoot, design)), `${design} exists`).toBe(true);
    }

    for (const file of implementation) {
      expect(existsSync(join(root, file)), `${file} exists`).toBe(true);
    }
  });
});
