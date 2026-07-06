import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";
import { getDict, localeFromAcceptLanguage, type Locale } from "@/lib/i18n";

/**
 * Drosia type system (see design handoff "Design System"):
 *  - Nunito  → display & numbers (700/800/900), tabular-nums on all figures.
 *  - Mulish  → body & UI (400/500/600/700).
 * Loaded via Google Fonts with the Greek + Latin subsets (the app is
 * multilingual EL/EN/DE). Self-host for production/EU.
 * Family names are exposed as --font-display / --font-sans in globals.css.
 */
const OG_LOCALE: Record<Locale, string> = { el: "el_GR", en: "en_GB", de: "de_DE" };

// Per-request so the title/description and <html lang> match the visitor's
// language (detected from Accept-Language) for SEO and assistive tech.
export async function generateMetadata(): Promise<Metadata> {
  const locale = localeFromAcceptLanguage((await headers()).get("accept-language"));
  const dict = getDict(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: dict.meta.title,
    description: dict.meta.description,
    applicationName: "Drosia",
    alternates: { canonical: "/" },
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
    openGraph: {
      type: "website",
      siteName: "Drosia",
      title: dict.meta.title,
      description: dict.meta.description,
      url: SITE_URL,
      locale: OG_LOCALE[locale],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#00B4C8",
};

// Every route renders per request: the CSP script nonce (middleware.ts) is
// minted per request, and statically prerendered HTML cannot carry one — its
// inline bootstrap scripts would be blocked. Applies app-wide from here.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // <html lang> reflects the server-detected locale so the first paint is
  // correct for search engines and screen readers (the client keeps it in sync
  // with a manual language choice — see LocaleProvider).
  const locale = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return (
    <html lang={locale}>
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
