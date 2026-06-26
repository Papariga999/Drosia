"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMapInstance } from "leaflet";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { BottomNav } from "@/components/ui/BottomNav";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel, CATEGORY_META } from "@/lib/categories";
import { reportAgeDays, severityColor } from "@/lib/severity";
import type { PublicReport } from "@/lib/mock";

type View = "pins" | "heat";

export function MapScreen({ reports = [] }: { reports?: PublicReport[] }) {
  const { dict } = useLocale();
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const [view, setView] = useState<View>("pins");
  const [sheet, setSheet] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const mappedReports = useMemo(
    () => reports.filter((report) => Number.isFinite(report.lat) && Number.isFinite(report.lng)),
    [reports],
  );
  const selectedReport =
    mappedReports.find((report) => report.public_token === selectedToken) ?? mappedReports[0];
  const hasReports = mappedReports.length > 0;

  const openReport = useCallback((report: PublicReport) => {
    setSelectedToken(report.public_token);
    setSheet(true);
  }, []);

  function locateUser() {
    if (!navigator.geolocation || !mapRef.current || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.setView([coords.latitude, coords.longitude], 15);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <div className="absolute left-1/2 top-2 z-[500] inline-flex -translate-x-1/2 rounded-xl bg-surface-card p-1 shadow-card">
        {(["pins", "heat"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setView(mode);
              setSheet(false);
            }}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
              view === mode ? "bg-ink text-ink-contrast" : "text-slate"
            }`}
          >
            {mode === "pins" ? dict.map.pins : dict.map.heatmap}
          </button>
        ))}
      </div>

      <div className="relative flex-1">
        <DrosiaMap
          reports={mappedReports}
          mode={view}
          selectedToken={selectedToken}
          onReportSelect={openReport}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
          className="absolute inset-0 z-0"
          ariaLabel={dict.bottomNav.map}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[450] px-4 pb-3 pt-12" style={{ background: "linear-gradient(var(--surface),transparent)" }}>
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-[14px] bg-surface-card px-3.5 py-3 shadow-card">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary text-[0]" aria-hidden />
            <span className="flex-1 text-[14px] font-semibold text-muted">{dict.map.search}</span>
          </div>
          <div className="pointer-events-auto mt-2.5 flex gap-2 overflow-hidden">
            <Chip active>{dict.map.near}</Chip>
            <Chip>{dict.map.open}</Chip>
            <Chip>{dict.map.cat}</Chip>
          </div>
        </div>

        <button
          onClick={locateUser}
          className="absolute bottom-28 right-4 z-[450] grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-surface-card text-[11px] font-black text-primary-ink shadow-card"
          aria-label={dict.map.near}
        >
          {locating ? "..." : "GPS"}
        </button>
        <Link
          href="/report"
          className="absolute bottom-16 right-4 z-[450] grid h-[62px] w-[62px] place-items-center rounded-[20px] bg-primary text-[26px] text-white shadow-btn"
          aria-label={dict.nav.report}
        >
          +
        </Link>

        {!hasReports && (
          <div className="absolute left-6 right-6 top-1/2 z-[450] -translate-y-1/2 rounded-[22px] bg-surface-card p-7 text-center shadow-float">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tint text-primary-ink">
              <span className="h-5 w-5 rounded-full border-[3px] border-current" aria-hidden />
            </div>
            <div className="mt-2.5 font-display text-[19px] font-black">{dict.map.emptyTitle}</div>
            <p className="mx-auto mb-4 mt-2 text-[13px] leading-relaxed text-slate">{dict.map.emptyBody}</p>
            <Link href="/report" className="inline-block rounded-[14px] bg-primary px-6 py-3 font-display text-[15px] font-extrabold text-white">
              {dict.map.emptyCta}
            </Link>
          </div>
        )}

        {sheet && selectedReport && hasReports && (
          <>
            <div className="absolute inset-0 z-[460] bg-ink-fixed/20" onClick={() => setSheet(false)} />
            <div className="absolute inset-x-0 bottom-0 z-[470] rounded-t-3xl bg-surface-card px-4 pb-5 pt-2.5 shadow-float">
              <div className="mx-auto mb-3.5 h-1 w-10 rounded-full bg-line-strong" />
              <ReportPreview report={selectedReport} />
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function ReportPreview({ report }: { report: PublicReport }) {
  const { locale, dict } = useLocale();
  const days = reportAgeDays(report);
  const meta = CATEGORY_META[report.category];

  return (
    <>
      <div className="flex gap-3.5">
        {report.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.photo_url} alt="" className="h-[88px] w-[88px] flex-none rounded-[14px] object-cover" />
        ) : (
          <div className="photo-placeholder h-[88px] w-[88px] flex-none rounded-[14px]" />
        )}
        <div className="flex-1">
          <span
            className="tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ color: severityColor(days), background: "var(--surface)" }}
          >
            {days} {dict.severity.days}
          </span>
          <div className="mt-1.5 font-display text-[16px] font-black">
            {meta.emoji} {categoryLabel(report.category, locale)}
          </div>
          <div className="mt-0.5 text-[12px] text-slate">
            {report.authority_name[locale] || "-"} · {report.vote_count}
          </div>
        </div>
      </div>
      <Link
        href={`/r/${report.public_token}`}
        className="mt-3.5 block w-full rounded-[14px] bg-ink py-3 text-center font-display text-[15px] font-extrabold text-ink-contrast"
      >
        {dict.map.details} &gt;
      </Link>
    </>
  );
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
