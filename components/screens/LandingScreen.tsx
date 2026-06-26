"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { DrosiaMark } from "@/components/brand/Logo";
import { useLocale } from "@/components/LocaleProvider";
import type { LandingStats } from "@/lib/stats";

function rateColor(rate: number): string {
  if (rate >= 60) return "var(--sev-fresh)";
  if (rate >= 30) return "var(--sev-warn)";
  return "var(--sev-stale)";
}

/** Animated count-up for the ShockStat (cubic ease-out over ~1.4s on mount). */
function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(Math.floor(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function LandingScreen({ stats }: { stats: LandingStats }) {
  const { locale, dict } = useLocale();
  const shock = useCountUp(stats.ignoredDays);
  const hasBoard = stats.board.length > 0;

  return (
    <div className="bg-surface pb-2">
      {/* top utility bar */}
      <div className="flex items-center justify-end gap-2 px-4 pt-3">
        <LangSwitch />
        <ThemeToggle />
      </div>

      {/* HERO */}
      <div
        className="px-6 pb-7 pt-3 text-center"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, var(--tint-soft), var(--surface))" }}
      >
        <DrosiaMark className="mx-auto mb-2 h-[70px] w-auto text-primary" gradient />
        <div className="font-display text-[30px] font-black tracking-display">Drosia</div>
        <div className="mt-1 font-display text-[17px] font-extrabold text-primary-ink">{dict.app.claim}</div>
        <p className="mx-auto mt-2.5 max-w-[300px] text-[13px] leading-relaxed text-slate">{dict.landing.intro}</p>
        <div className="mt-4 flex gap-2.5">
          <ButtonLink href="/report" variant="primary">📷 {dict.landing.ctaReport}</ButtonLink>
          <ButtonLink href="/map" variant="outline">🗺 {dict.landing.ctaMap}</ButtonLink>
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
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg,#dde9e7,#c7dad7)",
              backgroundImage:
                "linear-gradient(90deg,rgba(255,255,255,.55) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.55) 1px,transparent 1px)",
              backgroundSize: "42px 42px",
            }}
          />
          <Cluster left="24%" top="30%" n={8} />
          <Pin left="55%" top="54%" color="#E67E22" size={28} />
          <Pin left="40%" top="66%" color="#F4D03F" size={24} />
          <Pin left="70%" top="28%" color="#2ECC71" size={24} />
          <Pin left="73%" top="64%" color="#E74C3C" size={24} />
          <div className="absolute bottom-3 left-3 rounded-full bg-surface-card/90 px-3 py-1.5 text-[12px] font-bold shadow-card">
            📍 <span className="tnum">{stats.openCount}</span> {dict.landing.mapOpen}
          </div>
        </Link>
      </div>

      {/* SHOCKSTAT */}
      <div className="mx-4 mb-5 rounded-[22px] bg-ink p-6 text-center text-white">
        <div className="text-[13px] font-semibold text-[#8FB0B4]">{dict.landing.shockPre}</div>
        <div className="tnum my-1 font-display text-[56px] font-black leading-none text-accent">
          {shock.toLocaleString("de-DE")}
        </div>
        <div className="font-display text-[18px] font-extrabold">{dict.landing.shockPost}</div>
      </div>

      {/* HOW IT WORKS */}
      <div className="px-6 pb-6">
        <h2 className="mb-3.5 font-display text-[16px] font-black">{dict.landing.how}</h2>
        <div className="flex gap-2.5">
          {[
            { e: "📷", t: dict.landing.how1 },
            { e: "📨", t: dict.landing.how2 },
            { e: "🔔", t: dict.landing.how3 },
          ].map((s) => (
            <div key={s.t} className="flex-1 text-center">
              <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-[14px] bg-tint text-[22px]">
                {s.e}
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
                  <div className="grid w-1/2 place-items-center bg-[linear-gradient(180deg,#d6efdd,#a9e3c1)] text-2xl">✨</div>
                </div>
                <div className="px-2.5 py-2 font-display text-[12px] font-extrabold text-success">
                  ✅ {dict.landing.fixed} {g.days} {dict.severity.days}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* LEADERBOARD — only when an authority qualifies (n>=10); else mission/CTA. */}
      <div className="px-6 pb-6">
        {hasBoard ? (
          <div>
            <h2 className="mb-3 font-display text-[16px] font-black">🏆 {dict.landing.board}</h2>
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
            <p className="mt-2.5 text-[11px] leading-relaxed text-muted">⚖️ {dict.landing.fair}</p>
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-line-strong bg-surface-card p-5 text-center">
            <div className="text-[34px]">🌱</div>
            <div className="mt-2 font-display text-[16px] font-black">{dict.landing.emptyTitle}</div>
            <p className="mx-auto mb-3.5 mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-slate">
              {dict.landing.emptyBody}
            </p>
            <div className="mx-auto max-w-[200px]">
              <ButtonLink href="/report" variant="primary">📷 {dict.landing.ctaReport}</ButtonLink>
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
              { icon: "🏨", who: dict.landing.pHotel, value: dict.landing.pHotelV },
              { icon: "🏛", who: dict.landing.pMuni, value: dict.landing.pMuniV },
              { icon: "🌿", who: dict.landing.pNgo, value: dict.landing.pNgoV },
            ].map((p) => (
              <div key={p.who} className="flex items-start gap-3 rounded-[16px] border border-line bg-surface-card p-3.5">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-tint text-[20px]">{p.icon}</div>
                <div className="flex-1">
                  <div className="font-display text-[14px] font-extrabold">{p.who}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-slate">{p.value}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full rounded-[14px] bg-ink px-4 py-3.5 font-display text-[15px] font-extrabold text-white">
            {dict.landing.partnerCta}
          </button>
          <div className="mt-2.5 text-center text-[11px] text-muted">{dict.landing.partnerNote}</div>
        </div>
      </div>

      <footer className="px-6 pb-6 text-center text-[11px] text-muted">
        Drosia · drosia.eu · Datenschutz · Impressum · AGB
      </footer>
    </div>
  );
}

function Pin({ left, top, color, size }: { left: string; top: string; color: string; size: number }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-full drop-shadow" style={{ left, top }}>
      <DrosiaMark style={{ height: size, width: "auto", color }} />
    </div>
  );
}

function Cluster({ left, top, n }: { left: string; top: string; n: number }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }}>
      <div
        className="tnum grid h-[38px] w-[38px] place-items-center rounded-full border-[3px] border-white font-display text-[14px] font-black text-white shadow-card"
        style={{ background: "var(--sev-stale)" }}
      >
        {n}
      </div>
    </div>
  );
}
