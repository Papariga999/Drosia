"use client";

import Link from "next/link";
import { AppBar } from "@/components/ui/AppBar";
import { useLocale } from "@/components/LocaleProvider";
import { SupportContactForm } from "@/components/screens/SupportContactForm";

/**
 * Supporters / partners page — /support. Reached from the landing
 * "Start a conversation" CTA (which deep-links to #contact). Warm, mission-led
 * copy explaining why and who can support Drosia, then a short first-contact
 * form as the primary CTA. No payments, no packages — an open conversation.
 */
export function SupportScreen() {
  const { dict } = useLocale();
  const S = dict.support;

  const reasons = [
    { title: S.why1Title, body: S.why1Body },
    { title: S.why2Title, body: S.why2Body },
    { title: S.why3Title, body: S.why3Body },
  ];
  const audiences = [
    { icon: "🏨", who: S.whoHotel, body: S.whoHotelBody },
    { icon: "🏛", who: S.whoMuni, body: S.whoMuniBody },
    { icon: "🌿", who: S.whoNgo, body: S.whoNgoBody },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <AppBar showWordmark />
      <div className="mx-auto max-w-[680px] px-6 pb-16 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-bold text-primary-ink">
          ‹ {S.back}
        </Link>

        {/* Hero */}
        <div className="mt-4 text-[12px] font-bold uppercase tracking-wider text-primary-ink">{S.heroKicker}</div>
        <h1 className="mt-1.5 font-display text-[26px] font-black leading-tight">{S.heroTitle}</h1>
        <div className="mt-3 flex flex-col gap-3 text-[14px] leading-relaxed text-slate">
          <p>{S.heroP1}</p>
          <p>{S.heroP2}</p>
          <p>{S.heroP3}</p>
        </div>

        {/* Why support */}
        <h2 className="mt-10 font-display text-[20px] font-black">{S.whyTitle}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {reasons.map((r) => (
            <div key={r.title} className="rounded-[16px] border border-line bg-surface-card p-4">
              <div className="font-display text-[15px] font-extrabold">{r.title}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate">{r.body}</p>
            </div>
          ))}
        </div>

        {/* Who this is for */}
        <h2 className="mt-10 font-display text-[20px] font-black">{S.whoTitle}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {audiences.map((a) => (
            <div key={a.who} className="flex items-start gap-3 rounded-[16px] border border-line bg-surface-card p-4">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-tint text-[22px]">{a.icon}</div>
              <div className="flex-1">
                <div className="font-display text-[15px] font-extrabold">{a.who}</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate">{a.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* What support can look like */}
        <h2 className="mt-10 font-display text-[20px] font-black">{S.howTitle}</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-slate">{S.howBody}</p>
        <p className="mt-3 text-[14px] font-bold leading-relaxed text-ink">{S.howGoal}</p>

        {/* Contact form — primary CTA. #contact is the landing deep-link target. */}
        <section id="contact" className="mt-10 scroll-mt-20 rounded-[22px] border border-primary/20 bg-[linear-gradient(165deg,var(--tint-soft),var(--tint))] p-6">
          <h2 className="font-display text-[22px] font-black">{S.formTitle}</h2>
          <p className="mb-5 mt-2 text-[13px] leading-relaxed text-slate">{S.formIntro}</p>
          <SupportContactForm />
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">{S.formNote}</p>
        </section>
      </div>
    </div>
  );
}
