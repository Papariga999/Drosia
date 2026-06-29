import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleProvider } from "@/components/LocaleProvider";
import { TrackPageView } from "@/components/TrackPageView";

/**
 * Public-app shell. Mobile-first: the app lives in a centered phone-width
 * column so it reads well on both phones and desktop. Locale state (EL/EN/DE)
 * is provided here so the language switch re-renders copy live.
 *
 * Analytics is mounted HERE (not the root layout) so only public website traffic
 * is measured — operator activity on /admin is deliberately excluded. Both layers
 * are cookieless/privacy-first: Vercel Web Analytics + our first-party beacon.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="mx-auto min-h-screen w-full max-w-phone bg-surface-card shadow-card sm:my-0">
        {children}
      </div>
      <TrackPageView />
      <Analytics />
      <SpeedInsights />
    </LocaleProvider>
  );
}
