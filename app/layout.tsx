import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

/**
 * Drosia type system (see design handoff "Design System"):
 *  - Nunito  → display & numbers (700/800/900), tabular-nums on all figures.
 *  - Mulish  → body & UI (400/500/600/700).
 * Loaded via Google Fonts with the Greek + Latin subsets (the app is
 * multilingual EL/EN/DE). Self-host for production/EU.
 * Family names are exposed as --font-display / --font-sans in globals.css.
 */
export const metadata: Metadata = {
  title: "Drosia — Report litter",
  description:
    "Report litter & environmental issues to the responsible authority. Keep it fresh & clean.",
  applicationName: "Drosia",
  // Brand assets per design §3a: SVG favicon first (reads on light & dark
  // tabs), PNG fallbacks, iOS touch icon. Files exported from the design
  // bundle into public/brand/. The PWA manifest is app/manifest.ts.
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#00B4C8",
};

// Every route renders per request: the CSP script nonce (middleware.ts) is
// minted per request, and statically prerendered HTML cannot carry one — its
// inline bootstrap scripts would be blocked. Applies app-wide from here.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // lang is set per-locale by the LocaleProvider on the client; default 'el'.
  return (
    <html lang="el">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Mulish:wght@400;500;600;700&display=swap&subset=greek,latin,latin-ext"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
