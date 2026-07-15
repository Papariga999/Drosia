"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMapInstance } from "leaflet";
import { Hourglass, Sparkles, ThumbsUp } from "lucide-react";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { BottomNav } from "@/components/ui/BottomNav";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel } from "@/lib/categories";
import { fill } from "@/lib/i18n";
import { distanceKm } from "@/lib/geo";
import { reportAgeDays, severityColor, SEVERITY_COLOR } from "@/lib/severity";
import type { PublicReport } from "@/lib/mock";

export function MapScreen({ reports = [] }: { reports?: PublicReport[] }) {
  const { dict } = useLocale();
  const mapRef = useRef<LeafletMapInstance | null>(null);
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

  // Area stats strip (1d) — computed from the loaded (public, non-test)
  // reports: total reported, fixed, and average days-to-fix.
  const stats = useMemo(() => {
    const resolved = mappedReports.filter((r) => r.status === "resolved" && !r.pending);
    const real = mappedReports.filter((r) => !r.pending);
    const avgDays = resolved.length
      ? Math.round(resolved.reduce((sum, r) => sum + reportAgeDays(r), 0) / resolved.length)
      : null;
    return { reported: real.length, fixed: resolved.length, avgDays };
  }, [mappedReports]);

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
      <div className="relative flex-1">
        <DrosiaMap
          reports={mappedReports}
          mode="pins"
          selectedToken={selectedToken}
          onReportSelect={openReport}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
          className="absolute inset-0 z-0"
          ariaLabel={dict.bottomNav.map}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[450] px-4 pb-3 pt-4" style={{ background: "linear-gradient(var(--surface),transparent)" }}>
          {/* Stats strip (1d) — the map as a destination, not just a tool. */}
          {hasReports && (
            <div className="pointer-events-auto flex items-center justify-center gap-1.5 rounded-[14px] bg-surface-card/95 px-3 py-2.5 shadow-card backdrop-blur">
              <StatSeg value={stats.reported} label={dict.map.statReported} color="var(--ink)" />
              <Dot />
              <StatSeg value={stats.fixed} label={dict.map.statFixed} color="var(--success)" />
              {stats.avgDays !== null && (
                <>
                  <Dot />
                  <StatSeg value={stats.avgDays} label={dict.map.statAvgResp} color="var(--primary-ink)" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Severity legend (Katharos color coding) — bottom-left overlay. */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[450] rounded-[14px] bg-surface-card/95 px-3 py-2.5 shadow-card backdrop-blur">
          {[
            { color: SEVERITY_COLOR.fresh, label: dict.map.tierFresh },
            { color: SEVERITY_COLOR.mild, label: dict.map.tierMild },
            { color: SEVERITY_COLOR.warn, label: dict.map.tierWarn },
            { color: SEVERITY_COLOR.stale, label: dict.map.tierStale },
            { color: "var(--success)", label: dict.list.stResolved },
            { color: "var(--muted)", label: dict.pending.badge },
          ].map((row) => (
            <div key={row.label} className="mb-1 flex items-center gap-2 last:mb-0">
              <span className="h-3 w-3 flex-none rounded-full" style={{ background: row.color }} />
              <span className="text-[10px] font-bold text-slate">{row.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={locateUser}
          className="absolute bottom-36 right-4 z-[450] grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-surface-card text-primary-ink shadow-card"
          aria-label={dict.map.near}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className={locating ? "animate-pulse" : undefined}
            aria-hidden
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
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
              <ReportPreview report={selectedReport} all={mappedReports} />
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

/**
 * Pin-tap report card (1d): photo, severity-tinted age badge + status badge,
 * title, municipality + report ID, social proof — plus a resolved-nearby
 * teaser (resolved reports are the return-visit hook).
 */
function ReportPreview({ report, all }: { report: PublicReport; all: PublicReport[] }) {
  const { locale, dict } = useLocale();
  const days = reportAgeDays(report);
  const resolved = report.status === "resolved";

  const statusBadge = resolved
    ? { bg: "#EAFBF1", fg: "#1B8B4A", label: dict.list.stResolved }
    : report.status === "notified"
      ? { bg: "#FFF4DC", fg: "#B7820E", label: dict.list.stForwarded }
      : { bg: "var(--tint)", fg: "var(--primary-ink)", label: dict.list.stOpen };

  // Nearest resolved report (other than this one) — before/after teaser.
  const teaser = useMemo(() => {
    if (report.pending) return null;
    const candidates = all.filter((r) => r.status === "resolved" && r.public_token !== report.public_token);
    if (!candidates.length) return null;
    return (
      candidates
        .map((r) => ({ r, d: distanceKm(report.lat, report.lng, r.lat, r.lng) }))
        .sort((a, b) => a.d - b.d)[0]?.r ?? null
    );
  }, [all, report]);

  return (
    <>
      <div className="flex gap-3.5">
        {report.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.photo_url} alt="" className="h-[92px] w-[92px] flex-none rounded-[14px] object-cover" />
        ) : (
          <div className="photo-placeholder h-[92px] w-[92px] flex-none rounded-[14px]" />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {report.pending ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tint px-2.5 py-1 text-[11px] font-bold text-primary-ink">
                <Hourglass size={12} aria-hidden /> {dict.pending.badge}
              </span>
            ) : (
              <>
                <span
                  className="tnum inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ color: severityColor(days), background: `${severityColor(days)}1A` }}
                >
                  {resolved ? dict.severity.fixedAfter : dict.severity.openFor} {days} {dict.severity.days}
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: statusBadge.bg, color: statusBadge.fg }}
                >
                  {statusBadge.label}
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 font-display text-[16px] font-black">
            <CategoryIcon category={report.category} size={17} className="text-primary-ink" />
            {categoryLabel(report.category, locale)}
          </div>
          <div className="tnum mt-0.5 text-[12px] text-slate">
            {report.pending
              ? dict.pending.title
              : `${report.authority_name[locale] || "—"} · #${report.public_token.slice(0, 6)}`}
          </div>
          {!report.pending && report.vote_count > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-primary-ink">
              <ThumbsUp size={13} aria-hidden /> {fill(dict.tracking.wantFixed, { n: report.vote_count })}
            </div>
          )}
        </div>
      </div>

      {/* Resolved-nearby teaser (1d) */}
      {teaser && (
        <Link
          href={`/r/${teaser.public_token}`}
          className="mt-3 flex items-center gap-2.5 rounded-[14px] border border-success/40 bg-[#EAFBF1] p-2.5 dark:bg-success/10"
        >
          {teaser.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teaser.photo_url} alt="" className="h-10 w-10 flex-none rounded-[8px] object-cover" />
          ) : (
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[8px] bg-success/15 text-success">
              <Sparkles size={18} aria-hidden />
            </span>
          )}
          <span className="flex-1 text-[12px] font-bold leading-snug text-success">
            {fill(dict.map.teaserResolved, { n: reportAgeDays(teaser) })}
          </span>
          <span className="text-[15px] text-success">›</span>
        </Link>
      )}

      <Link
        href={`/r/${report.public_token}`}
        className="mt-3.5 block w-full rounded-[14px] bg-ink py-3 text-center font-display text-[15px] font-extrabold text-ink-contrast"
      >
        {dict.map.details} &gt;
      </Link>
    </>
  );
}

function StatSeg({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="tnum font-display text-[15px] font-black" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] font-bold text-slate">{label}</span>
    </span>
  );
}

function Dot() {
  return <span className="px-0.5 text-[11px] text-muted">·</span>;
}
