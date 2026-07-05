"use client";

import { useId } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  Landmark,
  Leaf,
  Map as MapIcon,
  MapPin,
  Scale,
  Send,
  Sparkles,
} from "lucide-react";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { DrosiaMark } from "@/components/brand/Logo";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { useLocale } from "@/components/LocaleProvider";
import { fill } from "@/lib/i18n";
import { RANKING_THRESHOLD } from "@/lib/ranking";
import { severityColor } from "@/lib/severity";
import type { LandingStats } from "@/lib/stats";
import type { PublicReport } from "@/lib/mock";

function rateColor(rate: number): string {
  if (rate >= 60) return "var(--sev-fresh)";
  if (rate >= 30) return "var(--sev-warn)";
  return "var(--sev-stale)";
}

/**
 * Water drop filling toward the ranking threshold (handover 1a): fill % =
 * delivered/10, subtle idle bob. Replaces the "ranking starts soon" dead end.
 */
function DropProgress({ pct }: { pct: number }) {
  const clip = useId();
  const clamped = Math.max(0, Math.min(1, pct));
  const drop = "M24 3C13.5 3 5 11.3 5 21.6 5 35 24 61 24 61s19-26 19-39.4C43 11.3 34.5 3 24 3Z";
  return (
    <svg width={40} height={53} viewBox="0 0 48 64" className="drosia-bob" aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={drop} />
        </clipPath>
      </defs>
      <path d={drop} fill="var(--tint)" />
      <rect
        x="0"
        width="48"
        y={61 - 58 * clamped}
        height={58 * clamped + 3}
        fill="var(--primary)"
        clipPath={`url(#${clip})`}
      />
      <path d={drop} fill="none" stroke="var(--primary)" strokeWidth={3} />
    </svg>
  );
}

export function LandingScreen({ stats, reports }: { stats: LandingStats; reports: PublicReport[] }) {
  const { locale, dict } = useLocale();
  const hasBoard = stats.board.length > 0;

  return (
    <div className="bg-surface pb-2">
      {/* top utility bar */}
      <div className="flex items-center justify-end gap-2 px-4 pt-3">
        <LangSwitch />
        <ThemeToggle />
      </div>

      {/* HERO — claim's third beat is the accountability differentiator (1a) */}
      <div
        className="px-6 pb-7 pt-3 text-center"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, var(--tint-soft), var(--surface))" }}
      >
        <DrosiaMark className="mx-auto mb-2 h-[70px] w-auto text-primary" gradient />
        <div className="font-display text-[30px] font-black tracking-display">Drosia</div>
        <div className="mt-1 font-display text-[17px] font-extrabold text-primary-ink">{dict.landing.claim}</div>
        <p className="mx-auto mt-2.5 max-w-[300px] text-[13px] leading-relaxed text-slate">{dict.landing.intro}</p>
        <div className="mt-4 flex gap-2.5">
          <ButtonLink href="/report" variant="primary">
            <Camera size={17} aria-hidden /> {dict.landing.ctaReport}
          </ButtonLink>
          <ButtonLink href="/map" variant="outline">
            <MapIcon size={17} aria-hidden /> {dict.landing.ctaMap}
          </ButtonLink>
        </div>
      </div>

      {/* LIVE MAP PREVIEW */}
      <div className="px-4 pb-5">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_4px_rgba(46,204,113,0.18)]" />
          <h2 className="font-display text-[16px] font-black">{dict.landing.mapTitle}</h2>
          <Link href="/map" className="ml-auto text-[12px] font-bold text-primary-ink">
            {dict.landing.mapAll} ›
          </Link>
        </div>
        <Link href="/map" className="relative block h-[220px] overflow-hidden rounded-[20px] border border-line-strong">
          <DrosiaMap
            reports={reports}
            interactive={false}
            showAttribution={false}
            showZoomControl={false}
            className="absolute inset-0"
            ariaLabel={dict.landing.mapTitle}
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-surface-card/90 px-3 py-1.5 text-[12px] font-bold shadow-card">
            <MapPin size={13} aria-hidden /> <span className="tnum">{stats.openCount}</span> {dict.landing.mapOpen}
          </div>
        </Link>
      </div>

      {/* CLOCK PROMISE (1a) — replaces the zero "ignored days" counter. Every
          report starts a clock; show the oldest open report's age, never a 0. */}
      <div className="mx-4 mb-5 rounded-[22px] bg-ink-fixed p-6 text-white">
        <div className="flex items-center gap-2.5">
          <Clock size={20} className="flex-none text-accent" aria-hidden />
          <div className="font-display text-[17px] font-extrabold leading-snug">{dict.landing.clockTitle}</div>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8FB0B4]">{dict.landing.clockBody}</p>
        {stats.oldestOpenDays !== null && stats.oldestOpenDays > 0 && (
          <div className="mt-3.5 flex items-baseline gap-2 border-t border-white/10 pt-3.5">
            <span className="text-[12px] font-semibold text-[#8FB0B4]">{dict.landing.clockOldest}</span>
            <span
              className="tnum ml-auto font-display text-[34px] font-black leading-none"
              style={{ color: severityColor(stats.oldestOpenDays) }}
            >
              {stats.oldestOpenDays}
            </span>
            <span className="font-display text-[14px] font-extrabold">{dict.severity.days}</span>
          </div>
        )}
      </div>

      {/* HOW IT WORKS */}
      <div className="px-6 pb-6">
        <h2 className="mb-3.5 font-display text-[16px] font-black">{dict.landing.how}</h2>
        <div className="flex gap-2.5">
          {[
            { icon: <Camera size={22} aria-hidden />, t: dict.landing.how1 },
            { icon: <Send size={22} aria-hidden />, t: dict.landing.how2 },
            { icon: <Bell size={22} aria-hidden />, t: dict.landing.how3 },
          ].map((s) => (
            <div key={s.t} className="flex-1 text-center">
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-[14px] bg-tint text-primary-ink">
                {s.icon}
              </div>
              <div className="text-[12px] font-bold text-slate">{s.t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BEFORE/AFTER GALLERY (resolved cases) */}
      {stats.gallery.length > 0 && (
        <div className="px-6 pb-6">
          <h2 className="font-display text-[16px] font-black">{dict.landing.gallery}</h2>
          <p className="mb-3 text-[12px] text-slate">{dict.landing.gallerySub}</p>
          <div className="flex gap-2.5">
            {stats.gallery.slice(0, 2).map((g) => (
              <Link key={g.token} href={`/r/${g.token}`} className="flex-1 overflow-hidden rounded-[16px] border border-line">
                <div className="flex h-[90px]">
                  {g.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.photo_url} alt="" className="w-1/2 object-cover" />
                  ) : (
                    <div className="photo-placeholder w-1/2" />
                  )}
                  <div className="grid w-1/2 place-items-center bg-[linear-gradient(180deg,#d6efdd,#a9e3c1)] text-[#1B8B4A]">
                    <Sparkles size={26} aria-hidden />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-2 font-display text-[12px] font-extrabold text-success">
                  <CheckCircle2 size={14} aria-hidden /> {dict.landing.fixed} {g.days} {dict.severity.days}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD — only when an authority qualifies (n>=10); otherwise the
          ranking-progress module (1a): how close the leading authority is. */}
      <div className="px-6 pb-6">
        {hasBoard ? (
          <div>
            <h2 className="mb-3 flex items-center gap-2 font-display text-[16px] font-black">
              <BarChart3 size={18} aria-hidden /> {dict.landing.board}
            </h2>
            <div className="rounded-[18px] border border-line bg-surface-card p-3.5">
              {stats.board.map((c, i) => {
                const color = rateColor(c.rate);
                return (
                  <Link key={c.authority_id} href={`/authority/${c.authority_id}`} className="mb-3 flex items-center gap-3 last:mb-0">
                    <div className="tnum w-5 font-display text-[16px] font-black" style={{ color }}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-[14px] font-extrabold">{c.name[locale] || c.name.en || "—"}</div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full" style={{ width: `${c.rate}%`, background: color }} />
                      </div>
                    </div>
                    <div className="tnum font-display text-[15px] font-black" style={{ color }}>
                      {c.rate}%
                    </div>
                  </Link>
                );
              })}
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <Scale size={13} className="mt-0.5 flex-none" aria-hidden /> {dict.landing.fair}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-[18px] border border-line bg-surface-card p-5">
            <DropProgress pct={(stats.progress?.delivered ?? 0) / RANKING_THRESHOLD} />
            <div className="flex-1">
              <div className="font-display text-[15px] font-black leading-snug">
                {stats.progress?.name[locale] || stats.progress?.name.en || dict.landing.progressArea}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((stats.progress?.delivered ?? 0) / RANKING_THRESHOLD) * 100}%` }}
                />
              </div>
              <div className="tnum mt-1.5 text-[12px] font-bold text-primary-ink">
                {stats.progress?.delivered ?? 0} / {RANKING_THRESHOLD}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-slate">
                {fill(dict.landing.progressToGo, {
                  n: RANKING_THRESHOLD - (stats.progress?.delivered ?? 0),
                  next: (stats.progress?.delivered ?? 0) + 1,
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SUPPORTERS */}
      <div className="px-4 pb-6">
        <div className="rounded-[22px] border border-primary/20 bg-[linear-gradient(165deg,var(--tint-soft),var(--tint))] p-5">
          <div className="text-[12px] font-bold uppercase tracking-wider text-primary-ink">{dict.landing.partnerKicker}</div>
          <div className="mt-1.5 font-display text-[19px] font-black leading-tight">{dict.landing.partnerTitle}</div>
          <p className="mb-4 mt-2 text-[13px] leading-relaxed text-slate">{dict.landing.partnerIntro}</p>
          <div className="flex flex-col gap-2.5">
            {[
              { icon: <Building2 size={20} aria-hidden />, who: dict.landing.pHotel, value: dict.landing.pHotelV },
              { icon: <Landmark size={20} aria-hidden />, who: dict.landing.pMuni, value: dict.landing.pMuniV },
              { icon: <Leaf size={20} aria-hidden />, who: dict.landing.pNgo, value: dict.landing.pNgoV },
            ].map((p) => (
              <div key={p.who} className="flex items-start gap-3 rounded-[16px] border border-line bg-surface-card p-3.5">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-tint text-primary-ink">{p.icon}</div>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-extrabold">{p.who}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-slate">{p.value}</div>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/support#contact"
            className="mt-4 block w-full rounded-[14px] bg-ink px-4 py-3.5 text-center font-display text-[15px] font-extrabold text-ink-contrast"
          >
            {dict.landing.partnerCta}
          </Link>
          <div className="mt-2.5 text-center text-[11px] text-muted">{dict.landing.partnerNote}</div>
        </div>
      </div>

      <footer className="px-6 pb-6 text-center text-[11px] text-muted">
        Drosia · drosia.eu · {dict.footer.privacy} · {dict.footer.imprint} · {dict.footer.terms}
      </footer>
    </div>
  );
}
