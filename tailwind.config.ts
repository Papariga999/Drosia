import type { Config } from "tailwindcss";

/**
 * Drosia — "Morning Freshness" palette (see DROSIA-BRAND-KONZEPT + design handoff).
 * Colors resolve to CSS variables defined in app/globals.css, so the same
 * class names work in light and dark. Geo-neutral, NOT Aegean-blue.
 * The severity scale is central to the product.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          ink: "var(--primary-ink)",
          fg: "#ffffff",
        },
        accent: "var(--accent)",
        success: "var(--success)",
        // Severity scale — "how long ignored" (freshness draining)
        severity: {
          fresh: "var(--sev-fresh)",
          mild: "var(--sev-mild)",
          warn: "var(--sev-warn)",
          stale: "var(--sev-stale)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          card: "var(--surface-card)",
          raised: "var(--surface-raised)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          // Text colour for `bg-ink` surfaces; flips with the theme so a
          // dark-mode `bg-ink` (which becomes near-white) gets dark text.
          contrast: "var(--ink-contrast)",
          // Constant deep teal that does NOT invert — for scrims/overlays and
          // hero stat blocks that must stay dark in both light and dark mode.
          fixed: "#0b2b30",
        },
        slate: "var(--slate)",
        muted: "var(--muted)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        tint: {
          DEFAULT: "var(--tint)",
          soft: "var(--tint-soft)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        btn: "var(--radius-btn)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        float: "var(--shadow-float)",
        btn: "var(--shadow-btn)",
      },
      letterSpacing: {
        display: "-0.02em",
      },
      maxWidth: {
        phone: "420px",
      },
    },
  },
  plugins: [],
};

export default config;
