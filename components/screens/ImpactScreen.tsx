"use client";

import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel, CATEGORY_META } from "@/lib/categories";
import { shortDate } from "@/lib/mock";
import type { DeviceImpact } from "@/lib/me";

/**
 * My impact (Screen 8) — honestly labelled "impact of THIS device" (a
 * device-scoped token, not an account). Driven by real data: reports owned by
 * the device's author_token. States: with-data / empty.
 */
export function ImpactScreen({ impact }: { impact: DeviceImpact }) {
  const { locale, dict } = useLocale();
  const hasData = impact.reported > 0;

  const statusKind = (s: string): "open" | "fwd" | "res" =>
    s === "resolved" ? "res" : s === "notified" ? "fwd" : "open";
  const badge: Record<"open" | "fwd" | "res", { bg: string; fg: string; label: string }> = {
    open: { bg: "#FFF4DC", fg: "#B7820E", label: dict.list.stOpen },
    fwd: { bg: "var(--tint)", fg: "var(--primary-ink)", label: dict.list.stForwarded },
    res: { bg: "#EAFBF1", fg: "#1B8B4A", label: dict.list.stResolved },
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-auto">
        {/* honestly-labelled header */}
        <div className="px-6 pb-5 pt-4 text-center" style={{ background: "radial-gradient(120% 80% at 50% 0%, var(--tint-soft), var(--surface))" }}>
          <div className="mx-auto mb-2.5 grid h-16 w-16 place-items-center rounded-[20px] bg-surface-card text-[30px] shadow-card">💧</div>
          <div className="font-display text-[20px] font-black">{dict.impact.title}</div>
          <div className="mt-1 text-[12px] text-muted">{dict.impact.device}</div>
        </div>

        {hasData ? (
          <div className="px-4">
            <div className="flex gap-2.5">
              <BigStat value={String(impact.reported)} label={dict.impact.reported} color="var(--primary-ink)" />
              <BigStat value={String(impact.resolved)} label={dict.impact.fixed} color="var(--success)" />
              <BigStat value={String(impact.confirms)} label={dict.impact.confirms} color="#FFB000" />
            </div>

            <h2 className="my-3 font-display text-[15px] font-black">{dict.impact.badges}</h2>
            <div className="flex gap-2.5">
              <Badge emoji="🥇" label={dict.impact.b1} locked={impact.reported < 1} />
              <Badge emoji="🛡" label={dict.impact.b2} locked={impact.reported < 5} progress={Math.min(100, impact.reported * 20)} />
              <Badge emoji="✨" label={dict.impact.b3} locked={impact.resolved < 1} />
            </div>

            <h2 className="my-3 font-display text-[15px] font-black">{dict.impact.mine}</h2>
            {impact.mine.map((m) => {
              const b = badge[statusKind(m.status)];
              return (
                <Link
                  key={m.token}
                  href={`/r/${m.token}`}
                  className="mb-2 flex items-center gap-3 rounded-[16px] border border-line bg-surface-card p-2.5"
                >
                  <div className="photo-placeholder h-12 w-12 flex-none rounded-[10px]" />
                  <div className="flex-1">
                    <div className="font-display text-[13px] font-extrabold">
                      {CATEGORY_META[m.category].emoji} {categoryLabel(m.category, locale)}
                    </div>
                    <div className="tnum text-[11px] text-muted">{shortDate(m.created_at)}</div>
                  </div>
                  <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: b.bg, color: b.fg }}>
                    {b.label}
                  </span>
                </Link>
              );
            })}

            <div className="mt-2 flex items-center gap-2.5 rounded-[14px] border border-[#F4D03F] bg-[#FFF8E6] p-3">
              <div className="text-[18px]">🔖</div>
              <div className="text-[11px] leading-relaxed text-[#7A5C0A]">{dict.impact.bookmark}</div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <div className="text-[46px]">🌱</div>
            <div className="mt-2.5 font-display text-[19px] font-black">{dict.impact.emptyTitle}</div>
            <p className="mx-auto mb-5 mt-2 max-w-[260px] text-[13px] leading-relaxed text-slate">{dict.impact.emptyBody}</p>
            <Link href="/report" className="inline-block rounded-[14px] bg-primary px-6 py-3.5 font-display text-[15px] font-extrabold text-white">
              📷 {dict.impact.emptyCta}
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function BigStat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-1 rounded-[18px] border border-line bg-surface-card p-4 text-center">
      <div className="tnum font-display text-[30px] font-black" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-slate">{label}</div>
    </div>
  );
}

function Badge({ emoji, label, locked, progress }: { emoji: string; label: string; locked?: boolean; progress?: number }) {
  return (
    <div
      className="flex-1 rounded-[16px] border p-3.5 text-center"
      style={{
        background: locked ? "var(--surface)" : "var(--surface-card)",
        borderColor: locked ? "var(--border-strong)" : "var(--border)",
        borderStyle: locked ? "dashed" : "solid",
        opacity: locked ? 0.8 : 1,
      }}
    >
      <div className="text-[26px]" style={{ filter: locked ? "grayscale(1)" : "none" }}>
        {emoji}
      </div>
      <div className="mt-1 text-[11px] font-bold" style={{ color: locked ? "var(--muted)" : "var(--slate)" }}>
        {label}
      </div>
      {locked && progress != null && (
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-line-strong">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
