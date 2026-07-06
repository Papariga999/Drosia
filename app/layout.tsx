import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Nunito, Mulish } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";
import { getDict, localeFromAcceptLanguage, type Locale } from "@/lib/i18n";

/**
 * Drosia type system (see design handoff "Design System"):
 *  - Nunito  → display & numbers (700/800/900), tabular-nums on all figures.
 *  - Mulish  → body & UI (400/500/600/700).
 * Self-hosted via next/font (no request to Google — EU/GDPR + LCP). Neither
 * family ships a Greek subset on Google Fonts, so Greek text intentionally
 * falls back to system-ui (exactly as it did with the CDN <link> before).
 * Exposed as --font-display / --font-sans, consumed in globals.css/tailwind.
 */
const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const mulish = Mulish({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang={locale} className={`${nunito.variable} ${mulish.variable}`}>
      <body>{children}</body>
    </html>
  );
}
