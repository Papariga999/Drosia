"use client";

import { useState } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { SeverityPill } from "@/components/ui/Severity";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { VoteBar } from "@/components/ui/VoteBar";
import { PhotoPlaceholder } from "@/components/ui/Photo";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { useLocale } from "@/components/LocaleProvider";
import { fill } from "@/lib/i18n";
import { categoryLabel, CATEGORY_META } from "@/lib/categories";
import { reportAgeDays, severityColor } from "@/lib/severity";
import { shortDate, formatDate, type PublicReport } from "@/lib/mock";

function ShareGlyph({ name }: { name: "whatsapp" | "facebook" | "x" | "link" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24" } as const;
  switch (name) {
    case "whatsapp":
      return (
        <svg {...common} fill="#25D366">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.5-.1l.7-.9c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.7-.1 1.4Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} fill="#1877F2">
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case "x":
      return (
        <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.9 2H22l-7 8 8.3 12h-6.5l-5-7.3L9.6 22H6.5l7.5-8.6L6 2h6.6l4.6 6.8L18.9 2Zm-1.1 18h1.8L8.3 4H6.4l11.4 16Z" />
        </svg>
      );
    case "link":
      return (
        <svg
          width={17}
          height={17}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
      );
  }
}

export function TrackingScreen({ report }: { report: PublicReport }) {
  const { locale, dict } = useLocale();
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  const resolved = report.status === "resolved";
  const days = reportAgeDays(report);
  const cat = CATEGORY_META[report.category];
  const catLabel = categoryLabel(report.category, locale);
  const pin = resolved ? "var(--success)" : severityColor(days);

  const timeline = [
    { label: dict.tracking.reported, date: shortDate(report.created_at), done: true },
    {
      label: dict.tracking.forwarded,
      date: report.notified_at ? shortDate(report.notified_at) : null,
      done: !!report.notified_at,
      current: !resolved && !!report.notified_at,
    },
    {
      label: dict.tracking.resolvedStep,
      date: report.resolved_at ? shortDate(report.resolved_at) : null,
      done: resolved,
      current: resolved,
    },
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
        <SeverityPill
          days={days}
          label={
            resolved
              ? `🟢 ${dict.severity.fixedAfter} ${days} ${dict.severity.days}`
              : `${dict.severity.openFor} ${days} ${dict.severity.days}`
          }
          className="mb-3"
        />
        <h1 className="font-display text-[23px] font-black leading-tight tracking-display">
          {catLabel}
        </h1>
        <p className="mt-1 text-[13px] text-slate">
          🏛 {report.authority_name[locale] || "—"}
          {report.place ? ` · ${report.place}` : ""} ·{" "}
          <span className="tnum">{formatDate(report.created_at)}</span>
        </p>
      </div>

      {/* Hero photo — anonymized only */}
      <PhotoPlaceholder
        className="mx-4 mt-4 h-[210px] rounded-[20px]"
        pixel={!resolved}
        src={report.photo_url}
      >
        <div className="absolute left-4 top-4 rounded-full bg-ink/80 px-3 py-1.5 text-[12px] font-bold text-white">
          {cat.emoji} {catLabel}
        </div>
        {resolved ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-success/30">
            <div className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-white bg-success text-[30px] text-white shadow-card">
              ✓
            </div>
            <span className="rounded-full bg-white px-3.5 py-1.5 font-display text-[13px] font-extrabold text-success">
              {dict.status.resolved}
            </span>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent p-3 text-[11px] font-semibold text-white">
            🔒 {fill(dict.tracking.photoAlt, { category: catLabel })}
          </div>
        )}
      </PhotoPlaceholder>

      {/* Engagement */}
      <div className="mx-4 mt-4 rounded-[20px] border border-line p-4">
        <VoteBar
          initialVotes={report.vote_count}
          initialConfirms={report.confirm_count}
          importantLabel={dict.tracking.important}
          stillHereLabel={dict.tracking.stillHere}
          socialProof={(n) => fill(dict.tracking.wantFixed, { n })}
        />
      </div>

      {/* Timeline */}
      <div className="px-6 pt-2">
        <StatusTimeline steps={timeline} />
      </div>

      {/* Share + secondary actions */}
      <div className="px-4 pt-5">
        <button className="w-full rounded-2xl bg-ink px-4 py-3.5 font-display text-[15px] font-extrabold text-white">
          📣 {dict.tracking.shareTitle}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <ShareBtn label="WhatsApp"><ShareGlyph name="whatsapp" /></ShareBtn>
          <ShareBtn label="Facebook"><ShareGlyph name="facebook" /></ShareBtn>
          <ShareBtn label="X"><ShareGlyph name="x" /></ShareBtn>
          <button
            onClick={copyLink}
            className="flex h-11 min-w-[104px] flex-1 items-center justify-center gap-2 rounded-[13px] border border-primary bg-tint text-[13px] font-bold text-primary-ink"
          >
            <ShareGlyph name="link" />
            {copied ? dict.common.copied : dict.common.copyLink}
          </button>
        </div>
        <div className="mt-3 flex gap-2.5">
          <button className="flex-1 rounded-btn border-[1.5px] border-success bg-surface-card px-3 py-3 font-display text-[13px] font-extrabold text-success">
            ✅ {dict.tracking.looksClean}
          </button>
          <button
            onClick={() => setFollowing((f) => !f)}
            aria-pressed={following}
            className={`flex-1 rounded-btn border-[1.5px] px-3 py-3 font-display text-[13px] font-extrabold ${
              following
                ? "border-primary bg-primary text-white"
                : "border-primary bg-surface-card text-primary-ink"
            }`}
          >
            🔔 {following ? dict.tracking.following : dict.tracking.follow}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">{dict.tracking.followDesc}</p>
      </div>

      {/* Mini-map */}
      <div className="relative mx-4 mt-5 h-[118px] overflow-hidden rounded-[18px] border border-line-strong">
        <DrosiaMap
          points={[{ lat: report.lat, lng: report.lng, color: pin, title: catLabel }]}
          center={[report.lat, report.lng]}
          zoom={15}
          fitToMarkers={false}
          interactive={false}
          showAttribution={false}
          showZoomControl={false}
          className="absolute inset-0"
          ariaLabel={dict.tracking.miniMap}
        />
        <span className="absolute bottom-2 right-3 rounded-full bg-surface-card/90 px-2 py-1 text-[10px] font-semibold text-slate">
          {dict.tracking.miniMap}
        </span>
      </div>

      {/* Nearby */}
      <div className="px-4 pt-4">
        <h2 className="mb-2.5 font-display text-[14px] font-extrabold">{dict.tracking.nearby}</h2>
        <div className="flex gap-2.5">
          <NearbyCard emoji="♻️" label={categoryLabel("plastic", locale)} days={22} />
          <NearbyCard emoji="🏖" label={categoryLabel("coast", locale)} days={71} />
        </div>
      </div>

      <footer className="px-5 pb-2 pt-5 text-center text-[11px] text-muted">
        Drosia · Datenschutz · Impressum ·{" "}
        <button onClick={() => setFlagOpen(true)} className="underline">⚐ {dict.tracking.flag}</button>
      </footer>

      {flagOpen && <FlagDialog token={report.public_token} onClose={() => setFlagOpen(false)} />}
    </div>
  );
}

function FlagDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const { dict } = useLocale();
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      await fetch("/api/flag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, reason, contact, website: "" }),
      });
      setSent(true);
      setTimeout(onClose, 1600);
    } catch {
      setSent(true); // generic ack; never reveal internals
      setTimeout(onClose, 1600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-3xl bg-surface-card p-5 shadow-float sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-[16px] font-black">⚐ {dict.tracking.flagTitle}</h3>
        {sent ? (
          <p className="py-6 text-center text-[14px] font-bold text-success">✓ {dict.tracking.flagSent}</p>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              placeholder={dict.tracking.flagReason}
              className="mt-3 h-[84px] w-full resize-none rounded-[14px] border-[1.5px] border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-primary"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value.slice(0, 200))}
              placeholder={dict.tracking.flagContact}
              className="mt-2 w-full rounded-[14px] border-[1.5px] border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-primary"
            />
            <div className="mt-3 flex gap-2.5">
              <button onClick={onClose} className="flex-1 rounded-btn border border-line bg-surface px-3 py-3 font-display text-[13px] font-extrabold text-slate">
                {dict.common.close}
              </button>
              <button
                onClick={submit}
                disabled={!reason.trim() || busy}
                className="flex-1 rounded-btn bg-ink px-3 py-3 font-display text-[13px] font-extrabold text-white disabled:opacity-50"
              >
                {busy ? dict.tracking.flagSending : dict.tracking.flagSubmit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ShareBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button className="flex h-11 min-w-[104px] flex-1 items-center justify-center gap-2 rounded-[13px] border border-line bg-surface text-[13px] font-bold text-ink">
      {children}
      {label}
    </button>
  );
}

function NearbyCard({ emoji, label, days }: { emoji: string; label: string; days: number }) {
  const { dict } = useLocale();
  return (
    <div className="flex-1 overflow-hidden rounded-[14px] border border-line">
      <PhotoPlaceholder className="h-16" pixel={false} />
      <div className="px-2.5 py-2">
        <div className="text-[11px] font-bold">
          {emoji} {label}
        </div>
        <div className="tnum font-display text-[13px] font-black" style={{ color: severityColor(days) }}>
          {days} {dict.severity.days}
        </div>
      </div>
    </div>
  );
}
