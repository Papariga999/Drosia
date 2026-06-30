"use client";

import Link from "next/link";
import { AppBar } from "@/components/ui/AppBar";
import { useLocale } from "@/components/LocaleProvider";

/** Contact address for supporters/partners. Env-configurable; defaults to info@drosia.eu. */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "info@drosia.eu";

/**
 * Supporters / partners info page — /support. Reached from the landing
 * "Become a supporter" CTA. Reuses the landing partner copy and adds a
 * mailto contact block (no payments — an open, non-binding conversation).
 */
export function SupportScreen() {
  const { dict } = useLocale();
  const L = dict.landing;
  const S = dict.support;
  const partners = [
    { icon: "🏨", who: L.pHotel, value: L.pHotelV },
    { icon: "🏛", who: L.pMuni, value: L.pMuniV },
    { icon: "🌿", who: L.pNgo, value: L.pNgoV },
  ];
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Drosia — Supporter")}`;

  return (
    <div className="min-h-screen bg-surface">
      <AppBar showWordmark />
      <div className="mx-auto max-w-[680px] px-6 pb-16 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-primary-ink">
          ‹ {S.back}
        </Link>

        <div className="mt-4 text-[12px] font-bold uppercase tracking-wider text-primary-ink">{L.partnerKicker}</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black leading-tight">{L.partnerTitle}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-slate">{L.partnerIntro}</p>

        <div className="mt-6 flex flex-col gap-3">
          {partners.map((p) => (
            <div key={p.who} className="flex items-start gap-3 rounded-[16px] border border-line bg-surface-card p-4">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-tint text-[22px]">{p.icon}</div>
              <div className="flex-1">
                <div className="font-display text-[15px] font-extrabold">{p.who}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-slate">{p.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[22px] border border-primary/20 bg-[linear-gradient(165deg,var(--tint-soft),var(--tint))] p-6 text-center">
          <h2 className="font-display text-[20px] font-black">{S.contactTitle}</h2>
          <p className="mx-auto mb-5 mt-2 max-w-[420px] text-[13px] leading-relaxed text-slate">{S.contactBody}</p>
          <a
            href={mailto}
            className="inline-block rounded-[14px] bg-ink px-7 py-3.5 font-display text-[15px] font-extrabold text-ink-contrast"
          >
            ✉ {S.contactCta}
          </a>
          <div className="mt-3 text-[12px] font-bold text-primary-ink">{CONTACT_EMAIL}</div>
          <div className="mt-1 text-[11px] text-muted">{L.partnerNote}</div>
        </div>
      </div>
    </div>
  );
}
