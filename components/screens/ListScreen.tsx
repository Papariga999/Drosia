"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel, CATEGORY_META } from "@/lib/categories";
import { reportAgeDays, severityColor } from "@/lib/severity";
import type { PublicReport } from "@/lib/mock";

type Tab = "near" | "region" | "nationwide";

/** Most-urgent list (Screen 5) — ranked by votes, then age. The
 * screenreader-friendly list view of the map. Data: v_public_reports. */
export function ListScreen({ reports = [] }: { reports?: PublicReport[] }) {
  const { locale, dict } = useLocale();
  const [tab, setTab] = useState<Tab>("near");

  const ranked = [...reports].sort(
    (a, b) => b.vote_count - a.vote_count || reportAgeDays(b) - reportAgeDays(a),
  );

  function badgeFor(status: PublicReport["status"]) {
    if (status === "resolved") return { bg: "#EAFBF1", fg: "#1B8B4A", label: dict.list.stResolved };
    if (status === "notified") return { bg: "var(--tint)", fg: "var(--primary-ink)", label: dict.list.stForwarded };
    return { bg: "#FFF4DC", fg: "#B7820E", label: dict.list.stOpen };
  }

  return (
    <div className="flex h-screen flex-col" id="list">
      <div className="border-b border-line bg-surface-card px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-[22px]">🔥</span>
          <h1 className="font-display text-[21px] font-black">{dict.list.title}</h1>
        </div>
        <p className="mb-3 mt-1 text-[13px] text-slate">{dict.list.sub}</p>
        <div className="flex gap-5">
          {(["near", "region", "nationwide"] as const).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className="border-b-[3px] pb-2.5 font-display text-[14px] font-extrabold"
              style={{
                color: tab === tk ? "var(--primary-ink)" : "var(--muted)",
                borderColor: tab === tk ? "var(--primary)" : "transparent",
              }}
            >
              {dict.list[tk]}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-surface px-8 text-center">
          <div className="text-[40px]">🌱</div>
          <p className="mt-2 text-[14px] font-bold text-slate">{dict.map.emptyTitle}</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-auto bg-surface px-4 py-3.5">
          {ranked.map((r, i) => {
            const rankColor = i === 0 ? "var(--sev-stale)" : i < 3 ? "var(--sev-warn)" : "var(--muted)";
            const days = reportAgeDays(r);
            const b = badgeFor(r.status);
            return (
              <li key={r.public_token}>
                <Link
                  href={`/r/${r.public_token}`}
                  className="mb-2.5 flex items-center gap-3 rounded-[18px] border border-line bg-surface-card p-3"
                >
                  <div className="tnum w-[22px] text-center font-display text-[18px] font-black" style={{ color: rankColor }}>
                    {i + 1}
                  </div>
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="" className="h-[60px] w-[60px] flex-none rounded-xl object-cover" />
                  ) : (
                    <div className="photo-placeholder h-[60px] w-[60px] flex-none rounded-xl" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[14px] font-extrabold">
                      {CATEGORY_META[r.category].emoji} {categoryLabel(r.category, locale)}
                    </div>
                    <div className="truncate text-[12px] text-slate">🏛 {r.authority_name[locale] || "—"}</div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <span className="tnum font-display text-[13px] font-black text-primary-ink">👍 {r.vote_count}</span>
                      <span className="tnum font-display text-[13px] font-black" style={{ color: severityColor(days) }}>
                        ⏱ {days} {dict.severity.days}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-2">
                    <span className="whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: b.bg, color: b.fg }}>
                      {b.label}
                    </span>
                    <span className="text-[16px] text-muted">↗</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <BottomNav />
    </div>
  );
}
