import { headers } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleProvider } from "@/components/LocaleProvider";
import { TrackPageView } from "@/components/TrackPageView";
import { localeFromAcceptLanguage } from "@/lib/i18n";

/**
 * Public-app shell. Mobile-first: the app lives in a centered phone-width
 * column so it reads well on both phones and desktop. Locale state (EL/EN/DE)
 * is provided here so the language switch re-renders copy live.
 *
 * Analytics is mounted HERE (not the root layout) so only public website traffic
 * is measured — operator activity on /admin is deliberately excluded. Both layers
 * are cookieless/privacy-first: Vercel Web Analytics + our first-party beacon.
 *
 * The initial locale is detected from the visitor's `Accept-Language` (device/
 * system language) server-side, so the first paint is already correct (no flash).
 * A previously saved manual choice still wins on the client (see LocaleProvider).
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const initialLocale = localeFromAcceptLanguage((await headers()).get("accept-language"));
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <div className="mx-auto min-h-screen w-full max-w-phone bg-surface-card shadow-card sm:my-0">
        {children}
      </div>
      <TrackPageView />
      <Analytics />
      <SpeedInsights />
    </LocaleProvider>
  );
}
