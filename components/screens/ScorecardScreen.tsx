"use client";

import { AppBar } from "@/components/ui/AppBar";
import { useLocale } from "@/components/LocaleProvider";
import type { AuthorityPageData } from "@/lib/authority";

/**
 * Authority scorecard (Screen 7) — accountability per authority. Always shows
 * the fairness disclaimer. States driven by real data: Ranked (n>=10) /
 * Not-ranked / Disputed. A score is only ever shown for >=10 delivered reports.
 */
export function ScorecardScreen({ data }: { data: AuthorityPageData }) {
  const { locale, dict } = useLocale();
  const name = data.name[locale] || data.name.en || "—";
  const rateColor = data.ranked && data.ranked.rate >= 60 ? "var(--success)" : "var(--sev-warn)";

  return (
    <div className="pb-10">
      <AppBar />

      <div className="mt-3 px-4">
        <div className="flex items-center gap-2.5 rounded-[20px] p-4 text-white" style={{ background: "linear-gradient(160deg,#00B4C8,#0096A8)" }}>
          <div className="grid h-12 w-12 place-items-center rounded-[14px] bg-white/20 text-[24px]">🏛</div>
          <div>
            <div className="font-display text-[20px] font-black">{name}</div>
            <div className="text-[12px] opacity-90">{dict.scorecard.level}</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {data.disputed && (
          <div className="mb-3.5 flex gap-2.5 rounded-[16px] border border-[#F4D03F] bg-[#FFF8E6] p-3.5">
            <div className="text-[20px]">⚠️</div>
            <div className="text-[12px] leading-relaxed text-[#7A5C0A]">{dict.scorecard.dispNote}</div>
          </div>
        )}

        {data.ranked ? (
          <>
            <div className="rounded-[20px] border border-line bg-surface-card p-5 text-center">
              <div className="text-[12px] font-bold uppercase tracking-wider text-muted">{dict.scorecard.rate}</div>
              <div className="tnum font-display text-[62px] font-black leading-none" style={{ color: rateColor }}>
                {data.ranked.rate}%
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#EAFBF1] px-3 py-1 text-[12px] font-bold text-[#1B8B4A]">
                🏆 {dict.scorecard.rank} {data.ranked.rank}
              </div>
            </div>
            <div className="mt-3 flex gap-2.5">
              <Stat value={String(data.ranked.notified)} label={dict.scorecard.open} color="var(--sev-warn)" />
              <Stat value={String(data.ranked.resolved)} label={dict.scorecard.resolved} color="var(--success)" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">⚖️ {dict.scorecard.fair}</p>
          </>
        ) : (
          <div className="rounded-[20px] border border-dashed border-line-strong bg-surface-card p-6 text-center">
            <div className="text-[38px]">📊</div>
            <div className="mt-2 font-display text-[18px] font-black">{dict.scorecard.notTitle}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate">{dict.scorecard.notBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, unit, label, color }: { value: string; unit?: string; label: string; color: string }) {
  return (
    <div className="flex-1 rounded-[16px] border border-line bg-surface-card p-3.5 text-center">
      <div className="tnum font-display text-[24px] font-black" style={{ color }}>
        {value}
        {unit && <span className="text-[13px] text-muted"> {unit}</span>}
      </div>
      <div className="text-[11px] text-slate">{label}</div>
    </div>
  );
}
