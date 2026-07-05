"use client";

import { useState } from "react";
import Link from "next/link";
import { Hourglass, Link2, Lock, Map as MapIcon } from "lucide-react";
import { AppBar } from "@/components/ui/AppBar";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel } from "@/lib/categories";
import { shortDate, formatDate } from "@/lib/mock";
import type { PendingReport } from "@/lib/reports";

/**
 * /r/<token> for a report that is NOT public yet (submitted, or approved but
 * the photo blur isn't done). Shows what the public pending pin shows — status
 * timeline, category, date, position — plus a banner explaining that photo &
 * details follow once the Drosia team approves. No photo, no description:
 * pre-moderation content never reaches a public URL. This page exists so a
 * link shared right after submitting lands somewhere honest instead of a 404.
 */
export function PendingScreen({ report }: { report: PendingReport }) {
  const { locale, dict } = useLocale();
  const [copied, setCopied] = useState(false);

  const catLabel = categoryLabel(report.category, locale);

  const timeline = [
    { label: dict.tracking.reported, date: shortDate(report.created_at), done: true },
    { label: dict.pending.badge, date: null, done: false, current: true },
    { label: dict.tracking.forwarded, date: null, done: false },
    { label: dict.tracking.resolvedStep, date: null, done: false },
  ];

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="pb-8">
      <AppBar showWordmark />

      <div className="px-5 pt-4">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[12px] font-bold text-primary-ink">
          <Hourglass size={13} aria-hidden /> {dict.pending.badge}
        </span>
        <h1 className="font-display text-[23px] font-black leading-tight tracking-display">
          {dict.pending.title}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate">
          <CategoryIcon category={report.category} size={15} className="flex-none text-primary-ink" />
          {catLabel} · <span className="tnum">{formatDate(report.created_at)}</span>
        </p>
      </div>

      {/* Approval banner */}
      <div className="mx-4 mt-4 rounded-[20px] border border-primary/30 bg-tint-soft p-4">
        <p className="flex items-start gap-1.5 text-[13px] font-bold leading-relaxed text-primary-ink">
          <Hourglass size={14} className="mt-0.5 flex-none" aria-hidden /> {dict.pending.mapNote}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-slate">
          <Lock size={14} className="mt-0.5 flex-none" aria-hidden /> {dict.pending.sub}
        </p>
        <p className="mt-2 text-[13px] font-bold text-primary-ink">{dict.pending.keep}</p>
      </div>

      {/* Mini-map: same neutral pending pin the public map shows */}
      <div className="relative mx-4 mt-4 h-[140px] overflow-hidden rounded-[18px] border border-line-strong">
        <DrosiaMap
          points={[{ lat: report.lat, lng: report.lng, color: "var(--muted)", title: catLabel }]}
          center={[report.lat, report.lng]}
          zoom={15}
          fitToMarkers={false}
          interactive={false}
          showAttribution={false}
          showZoomControl={false}
          className="absolute inset-0"
          ariaLabel={dict.pending.badge}
        />
        <span className="absolute bottom-2 right-3 inline-flex items-center gap-1 rounded-full bg-surface-card/90 px-2 py-1 text-[10px] font-semibold text-slate">
          <Hourglass size={10} aria-hidden /> {dict.pending.badge}
        </span>
      </div>

      <div className="px-6 pt-4">
        <StatusTimeline steps={timeline} />
      </div>

      <div className="px-4 pt-3">
        <button
          onClick={copyLink}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-tint px-4 py-3.5 font-display text-[15px] font-extrabold text-primary-ink"
        >
          <Link2 size={16} aria-hidden /> {copied ? dict.common.copied : dict.common.copyLink}
        </button>
        <Link
          href="/map"
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface-card px-4 py-3.5 text-center font-display text-[15px] font-extrabold text-ink"
        >
          <MapIcon size={16} aria-hidden /> {dict.pending.onMap}
        </Link>
      </div>
    </div>
  );
}
