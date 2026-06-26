import type { Metadata } from "next";
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
  title: "Drosia",
  description:
    "Report litter & environmental issues to the responsible authority. Keep it fresh & clean.",
  applicationName: "Drosia",
};

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
