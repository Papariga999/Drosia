"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { DrosiaMark } from "@/components/brand/Logo";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel, CATEGORY_META } from "@/lib/categories";
import { reportAgeDays, severityColor } from "@/lib/severity";
import type { PublicReport } from "@/lib/mock";

type View = "pins" | "heat" | "empty";

/**
 * Map (Screen 2) — full-screen stylized map with severity drop-pins + clusters,
 * search + filter chips, locate button, camera FAB, bottom-nav. Pin → bottom
 * sheet preview → details. States: Pins / Heatmap / Empty.
 * `reports` now comes from v_public_reports (server). The stylized canvas is a
 * placeholder; the Leaflet/MapLibre engine swap (real pin coordinates) is next.
 */
export function MapScreen({ reports = [] }: { reports?: PublicReport[] }) {
  const { locale, dict } = useLocale();
  const featured = reports[0];
  const [view, setView] = useState<View>(reports.length ? "pins" : "empty");
  const [sheet, setSheet] = useState(false);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      {/* Demo state switcher */}
      <div className="absolute left-1/2 top-2 z-30 inline-flex -translate-x-1/2 rounded-xl bg-surface-card p-1 shadow-card">
        {(["pins", "heat", "empty"] as const).map((v) => (
          <button
            key={v}
            onClick={() => { setView(v); setSheet(false); }}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${view === v ? "bg-ink text-white" : "text-slate"}`}
          >
            {v === "pins" ? dict.map.pins : v === "heat" ? dict.map.heatmap : "Empty"}
          </button>
        ))}
      </div>

      {/* Map canvas */}
      <div className="relative flex-1">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg,#dde9e7,#c7dad7)",
            backgroundImage:
              "linear-gradient(90deg,rgba(255,255,255,.55) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.55) 1px,transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        >
          {/* coastline + roads hints */}
          <div className="absolute -bottom-16 -left-10 h-72 w-72 rounded-full opacity-60" style={{ background: "radial-gradient(circle at 40% 40%,#a9d4d9,#bfe0e3)" }} />
          <div className="absolute right-[-30px] top-28 h-52 w-40 rounded-full opacity-50" style={{ background: "radial-gradient(circle,#a9d4d9,#cfe6e8)" }} />
          <div className="absolute left-0 right-0 top-[46%] h-1.5 -rotate-[4deg] bg-white/70" />

          {view === "heat" && (
            <>
              <Blob left="24%" top="30%" size={150} color="rgba(231,76,60,0.6)" />
              <Blob left="54%" top="50%" size={120} color="rgba(230,126,34,0.55)" />
              <Blob left="38%" top="62%" size={100} color="rgba(244,208,63,0.5)" />
              <Blob left="66%" top="24%" size={90} color="rgba(46,204,113,0.45)" />
            </>
          )}

          {view === "pins" && (
            <>
              <button onClick={() => setSheet(true)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: "26%", top: "32%" }}>
                <span className="tnum grid h-[46px] w-[46px] place-items-center rounded-full border-[3px] border-white font-display text-[17px] font-black text-white shadow-card" style={{ background: "var(--sev-stale)" }}>
                  8
                </span>
              </button>
              <MapPin left="55%" top="52%" color="#E67E22" size={34} onClick={() => setSheet(true)} />
              <MapPin left="40%" top="64%" color="#F4D03F" size={30} onClick={() => setSheet(true)} />
              <MapPin left="67%" top="26%" color="#2ECC71" size={30} onClick={() => setSheet(true)} />
              <MapPin left="72%" top="62%" color="#E74C3C" size={30} onClick={() => setSheet(true)} />
            </>
          )}
        </div>

        {/* Search + filters */}
        <div className="absolute inset-x-0 top-0 px-4 pb-3 pt-12" style={{ background: "linear-gradient(var(--surface),transparent)" }}>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-surface-card px-3.5 py-3 shadow-card">
            <span className="text-[16px]">🔍</span>
            <span className="flex-1 text-[14px] font-semibold text-muted">{dict.map.search}</span>
          </div>
          <div className="mt-2.5 flex gap-2 overflow-hidden">
            <Chip active>📍 {dict.map.near}</Chip>
            <Chip>{dict.map.open}</Chip>
            <Chip>🗑 {dict.map.cat}</Chip>
          </div>
        </div>

        {/* Locate + FAB */}
        <button className="absolute bottom-28 right-4 grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-surface-card text-[20px] shadow-card">🎯</button>
        <Link href="/report" className="absolute bottom-16 right-4 grid h-[62px] w-[62px] place-items-center rounded-[20px] bg-primary text-[26px] text-white shadow-btn">📷</Link>

        {/* Empty state */}
        {view === "empty" && (
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 rounded-[22px] bg-surface-card p-7 text-center shadow-float">
            <div className="text-[44px]">💧</div>
            <div className="mt-2.5 font-display text-[19px] font-black">{dict.map.emptyTitle}</div>
            <p className="mx-auto mb-4 mt-2 text-[13px] leading-relaxed text-slate">{dict.map.emptyBody}</p>
            <Link href="/report" className="inline-block rounded-[14px] bg-primary px-6 py-3 font-display text-[15px] font-extrabold text-white">
              📷 {dict.map.emptyCta}
            </Link>
          </div>
        )}

        {/* Bottom sheet */}
        {sheet && view !== "empty" && (
          <>
            <div className="absolute inset-0 bg-ink/20" onClick={() => setSheet(false)} />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface-card px-4 pb-5 pt-2.5 shadow-float">
              <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-line-strong" />
              {featured ? (
                (() => {
                  const days = reportAgeDays(featured);
                  const meta = CATEGORY_META[featured.category];
                  return (
                    <>
                      <div className="flex gap-3.5">
                        {featured.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={featured.photo_url} alt="" className="h-[88px] w-[88px] flex-none rounded-[14px] object-cover" />
                        ) : (
                          <div className="photo-placeholder h-[88px] w-[88px] flex-none rounded-[14px]" />
                        )}
                        <div className="flex-1">
                          <span
                            className="tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                            style={{ color: severityColor(days), background: "var(--surface)" }}
                          >
                            ⏱ {days} {dict.severity.days}
                          </span>
                          <div className="mt-1.5 font-display text-[16px] font-black">
                            {meta.emoji} {categoryLabel(featured.category, locale)}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate">
                            🏛 {featured.authority_name[locale] || "—"} · 👍 {featured.vote_count}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={`/r/${featured.public_token}`}
                        className="mt-3.5 block w-full rounded-[14px] bg-ink py-3 text-center font-display text-[15px] font-extrabold text-white"
                      >
                        {dict.map.details} ›
                      </Link>
                    </>
                  );
                })()
              ) : (
                <div className="py-4 text-center text-[13px] text-slate">{dict.map.emptyTitle}</div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function MapPin({ left, top, color, size, onClick }: { left: string; top: string; color: string; size: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="absolute -translate-x-1/2 -translate-y-full drop-shadow" style={{ left, top }}>
      <DrosiaMark style={{ height: size, width: "auto", color }} />
    </button>
  );
}

function Blob({ left, top, size, color }: { left: string; top: string; size: number; color: string }) {
  return <div className="absolute rounded-full" style={{ left, top, width: size, height: size, background: `radial-gradient(circle,${color},transparent 70%)` }} />;
}

function Chip({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold shadow-card"
      style={{
        background: active ? "var(--primary)" : "var(--surface-card)",
        color: active ? "#fff" : "var(--slate)",
      }}
    >
      {children}
    </span>
  );
}
