"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCircle2, Flag, Landmark, Lock, Share2 } from "lucide-react";
import { canFollow, followReport } from "@/lib/push/client";
import { AppBar } from "@/components/ui/AppBar";
import { SeverityPill } from "@/components/ui/Severity";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { VoteBar } from "@/components/ui/VoteBar";
import { PhotoPlaceholder } from "@/components/ui/Photo";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { useLocale } from "@/components/LocaleProvider";
import { fill } from "@/lib/i18n";
import { categoryLabel } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { reportAgeDays, severityColor } from "@/lib/severity";
import { shortDate, formatDate, type NearbyReport, type PublicReport } from "@/lib/mock";
import { trackEvent, type ShareChannel } from "@/lib/track";

/**
 * Session "tour" — the trail of report tokens visited in this tab. Swiping
 * forward always targets the nearest report NOT already on the trail (no A↔B
 * ping-pong); swiping back walks the trail in reverse. sessionStorage only:
 * dies with the tab, no cookie, consistent with the no-tracking posture.
 */
const TOUR_KEY = "drosia_tour";
const TOUR_MAX = 50;

function readTour(): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(TOUR_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

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

export function TrackingScreen({
  report,
  nearby = [],
}: {
  report: PublicReport;
  nearby?: NearbyReport[];
}) {
  const { locale, dict } = useLocale();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  // Follow needs Web-Push support + a VAPID key (WO-6, mirrors the success
  // screen). Detected in an effect: canFollow() reads window/navigator, so
  // checking it during render would mismatch the server-rendered HTML.
  const [pushSupported, setPushSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushSupported(canFollow());
  }, []);

  // Swipe-through navigation (nearest report next, trail back).
  const [tour, setTour] = useState<string[]>([]);
  const [dragX, setDragX] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const gesture = useRef<{ x: number; y: number; horizontal?: boolean } | null>(null);
  const navigating = useRef(false);

  useEffect(() => {
    const trail = readTour();
    if (trail[trail.length - 1] !== report.public_token) {
      // Arrived by swiping back → pop; otherwise this is a new forward step.
      if (trail[trail.length - 2] === report.public_token) trail.pop();
      else trail.push(report.public_token);
      try {
        sessionStorage.setItem(TOUR_KEY, JSON.stringify(trail.slice(-TOUR_MAX)));
      } catch {
        /* storage full/blocked — tour just won't persist */
      }
    }
    window.setTimeout(() => setTour(trail.slice(-TOUR_MAX)), 0);
  }, [report.public_token]);

  const prevToken = tour.length > 1 ? tour[tour.length - 2] : null;
  const next = useMemo(() => {
    if (!nearby.length) return null;
    return (
      nearby.find((r) => !tour.includes(r.public_token)) ??
      nearby.find((r) => r.public_token !== prevToken) ??
      nearby[0]
    );
  }, [nearby, tour, prevToken]);

  useEffect(() => {
    if (next) router.prefetch(`/r/${next.public_token}`);
  }, [next, router]);

  function navigate(dir: 1 | -1, token: string) {
    if (navigating.current) return;
    navigating.current = true;
    setLeaving(dir);
    if (dir === 1) trackEvent("nearby_next", { reportToken: token });
    // Let the slide-out play before the route change swaps the screen.
    setTimeout(() => router.push(`/r/${token}`), 190);
  }
  const goNext = () => next && navigate(1, next.public_token);
  const goPrev = () => prevToken && navigate(-1, prevToken);

  function onTouchStart(e: React.TouchEvent) {
    if (leaving) return;
    const t = e.touches[0];
    if (!t) return;
    gesture.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchMove(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g || leaving) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.horizontal === undefined) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // not decided yet
      g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    }
    if (!g.horizontal) return;
    // Rubber-band when there is nothing in that direction.
    const blocked = (dx < 0 && !next) || (dx > 0 && !prevToken);
    setDragX(blocked ? dx / 4 : dx);
  }
  function onTouchEnd() {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.horizontal) return;
    if (dragX <= -64 && next) goNext();
    else if (dragX >= 64 && prevToken) goPrev();
    else setDragX(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const resolved = report.status === "resolved";
  const days = reportAgeDays(report);
  const catLabel = categoryLabel(report.category, locale);
  const pin = resolved ? "var(--success)" : severityColor(days);
  // The shell follows the finger while dragging, then slides out through the
  // side (and fades) once a swipe or pill tap commits the navigation.
  const shellStyle = {
    transform: leaving ? `translateX(${leaving * -100}%)` : `translateX(${dragX}px)`,
    opacity: leaving ? 0 : 1,
    transition: dragX && !leaving ? "none" : "transform 190ms ease, opacity 190ms ease",
  };

  // 4-step retention timeline (1e). "Acknowledged" has no dedicated data-model
  // status yet (see handover follow-ups) — it is only shown as reached once the
  // report is resolved, never invented for open reports.
  const timeline = [
    {
      label: dict.tracking.reported,
      date: shortDate(report.created_at),
      done: true,
      current: !resolved && !report.notified_at,
    },
    {
      label: dict.tracking.forwarded,
      date: report.notified_at ? shortDate(report.notified_at) : null,
      done: !!report.notified_at,
      current: !resolved && !!report.notified_at,
    },
    {
      label: dict.tracking.acknowledged,
      date: null,
      done: resolved,
    },
    {
      label: dict.tracking.resolvedStep,
      date: report.resolved_at ? shortDate(report.resolved_at) : null,
      done: resolved,
    },
  ];

  function reportUrl(): string {
    return `${window.location.origin}/r/${report.public_token}`;
  }

  function recordShare(channel: ShareChannel) {
    trackEvent("share_click", { reportToken: report.public_token, shareChannel: channel });
  }

  function openShare(channel: Exclude<ShareChannel, "copy" | "native" | "other">) {
    recordShare(channel);
    const url = encodeURIComponent(reportUrl());
    const text = encodeURIComponent(dict.tracking.shareTitle);
    const targets: Record<typeof channel, string> = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    };
    window.open(targets[channel], "_blank", "noopener,noreferrer");
  }

  function copyLink() {
    navigator.clipboard?.writeText(reportUrl()).catch(() => {});
    recordShare("copy");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function nativeShare() {
    if (!navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({ title: dict.tracking.shareTitle, url: reportUrl() });
      recordShare("native");
    } catch {
      /* user cancelled or the platform refused the share sheet */
    }
  }

  return (
    <>
    {/* Sliding shell. The next-report pill and the flag dialog live OUTSIDE:
        a transformed ancestor would hijack their position:fixed. The clip
        wrapper keeps the translated shell from widening the page. */}
    <div className="overflow-x-clip">
    <div
      className={next ? "pb-24" : "pb-8"}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        gesture.current = null;
        setDragX(0);
      }}
      style={shellStyle}
    >
      <AppBar showWordmark />

      <div className="px-5 pt-4">
        <SeverityPill
          days={days}
          label={
            resolved
              ? `${dict.severity.fixedAfter} ${days} ${dict.severity.days}`
              : `${dict.severity.openFor} ${days} ${dict.severity.days}`
          }
          className="mb-3"
        />
        <h1 className="font-display text-[23px] font-black leading-tight tracking-display">
          {catLabel}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate">
          <Landmark size={14} className="flex-none" aria-hidden />
          <span>
            {report.authority_name[locale] || "—"}
            {report.place ? ` · ${report.place}` : ""} ·{" "}
            <span className="tnum">{formatDate(report.created_at)}</span>
          </span>
        </p>
      </div>

      {/* Hero photo — anonymized only. No category chip: the headline right
          above already names it, and the photo reads calmer without overlays. */}
      <PhotoPlaceholder
        className="mx-4 mt-4 h-[210px] rounded-[20px]"
        pixel={!resolved}
        src={report.photo_url}
      >
        {resolved ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-success/30">
            <div className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-white bg-success text-white shadow-card">
              <Check size={30} aria-hidden />
            </div>
            <span className="rounded-full bg-white px-3.5 py-1.5 font-display text-[13px] font-extrabold text-success">
              {dict.status.resolved}
            </span>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-ink-fixed/60 to-transparent p-3 text-[11px] font-semibold text-white">
            <Lock size={12} className="flex-none" aria-hidden /> {fill(dict.tracking.photoAlt, { category: catLabel })}
          </div>
        )}
      </PhotoPlaceholder>

      {/* Engagement */}
      <div className="mx-4 mt-4 rounded-[20px] border border-line p-4">
        <VoteBar
          token={report.public_token}
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
        <button
          onClick={() => void nativeShare()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 font-display text-[15px] font-extrabold text-ink-contrast"
        >
          <Share2 size={17} aria-hidden /> {dict.tracking.shareTitle}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <ShareBtn label="WhatsApp" onClick={() => openShare("whatsapp")}><ShareGlyph name="whatsapp" /></ShareBtn>
          <ShareBtn label="Facebook" onClick={() => openShare("facebook")}><ShareGlyph name="facebook" /></ShareBtn>
          <ShareBtn label="X" onClick={() => openShare("x")}><ShareGlyph name="x" /></ShareBtn>
          <button
            onClick={copyLink}
            className="flex h-11 min-w-[104px] flex-1 items-center justify-center gap-2 rounded-[13px] border border-primary bg-tint text-[13px] font-bold text-primary-ink"
          >
            <ShareGlyph name="link" />
            {copied ? dict.common.copied : dict.common.copyLink}
          </button>
        </div>
        <div className="mt-3 flex gap-2.5">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-btn border-[1.5px] border-success bg-surface-card px-3 py-3 font-display text-[13px] font-extrabold text-success">
            <CheckCircle2 size={15} aria-hidden /> {dict.tracking.looksClean}
          </button>
          {pushSupported && (
            <button
              onClick={async () => {
                if (following) return;
                const r = await followReport(report.public_token);
                if (r === "followed") setFollowing(true);
              }}
              aria-pressed={following}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-btn border-[1.5px] px-3 py-3 font-display text-[13px] font-extrabold ${
                following
                  ? "border-primary bg-primary text-white"
                  : "border-primary bg-surface-card text-primary-ink"
              }`}
            >
              <Bell size={15} aria-hidden /> {following ? dict.tracking.following : dict.tracking.follow}
            </button>
          )}
        </div>
        {pushSupported && (
          <p className="mt-2 text-center text-[11px] text-muted">{dict.tracking.followDesc}</p>
        )}
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
        {nearby.length ? (
          <div className="flex gap-2.5">
            {nearby.slice(0, 2).map((r) => (
              <NearbyCard key={r.public_token} report={r} />
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-line bg-surface-card px-3 py-3 text-[12px] font-semibold text-muted">
            {dict.tracking.nearbyEmpty}
          </div>
        )}
      </div>

      <footer className="px-5 pb-2 pt-5 text-center text-[11px] text-muted">
        Drosia ·{" "}
        <Link href="/privacy" className="underline-offset-2 hover:underline">{dict.footer.privacy}</Link> ·{" "}
        <Link href="/imprint" className="underline-offset-2 hover:underline">{dict.footer.imprint}</Link> ·{" "}
        <button onClick={() => setFlagOpen(true)} className="inline-flex items-center gap-1 underline">
          <Flag size={11} aria-hidden /> {dict.tracking.flag}
        </button>
      </footer>
    </div>
    </div>

    {/* Floating swipe affordance: the nearest unvisited report, one tap away.
        Doubles as the desktop navigation for the swipe gesture. */}
    {next && !flagOpen && (
      <nav
        aria-label={dict.tracking.nearby}
        className={`pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex justify-center transition-opacity duration-150 ${leaving ? "opacity-0" : ""}`}
      >
        <div className="pointer-events-auto flex items-stretch overflow-hidden rounded-full border border-line bg-surface-card/95 shadow-float backdrop-blur">
          <button
            onClick={goPrev}
            disabled={!prevToken}
            aria-label={dict.tracking.prevReport}
            className="grid w-11 place-items-center border-r border-line text-[17px] text-slate disabled:opacity-30"
          >
            ‹
          </button>
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 py-2.5 pl-3.5 pr-4 text-[12.5px] font-bold"
          >
            <CategoryIcon category={next.category} size={15} className="text-primary-ink" />
            {dict.tracking.nextReport}
            <span className="tnum font-semibold text-muted">· {formatDistance(next.distance_km)}</span>
            <span aria-hidden className="text-[15px]">›</span>
          </button>
        </div>
      </nav>
    )}

    {flagOpen && <FlagDialog token={report.public_token} onClose={() => setFlagOpen(false)} />}
    </>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-fixed/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-3xl bg-surface-card p-5 shadow-float sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="flex items-center gap-1.5 font-display text-[16px] font-black">
          <Flag size={15} aria-hidden /> {dict.tracking.flagTitle}
        </h3>
        {sent ? (
          <p className="flex items-center justify-center gap-1.5 py-6 text-center text-[14px] font-bold text-success">
            <Check size={15} aria-hidden /> {dict.tracking.flagSent}
          </p>
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
                className="flex-1 rounded-btn bg-ink px-3 py-3 font-display text-[13px] font-extrabold text-ink-contrast disabled:opacity-50"
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

function ShareBtn({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-11 min-w-[104px] flex-1 items-center justify-center gap-2 rounded-[13px] border border-line bg-surface text-[13px] font-bold text-ink">
      {children}
      {label}
    </button>
  );
}

function NearbyCard({ report }: { report: NearbyReport }) {
  const { locale, dict } = useLocale();
  const days = reportAgeDays(report);
  const label = categoryLabel(report.category, locale);
  return (
    <Link href={`/r/${report.public_token}`} className="flex-1 overflow-hidden rounded-[14px] border border-line bg-surface-card">
      <PhotoPlaceholder className="h-16" pixel={false} src={report.photo_url} />
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1 truncate text-[11px] font-bold">
          <CategoryIcon category={report.category} size={13} className="flex-none text-primary-ink" /> {label}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="tnum font-display text-[13px] font-black" style={{ color: severityColor(days) }}>
            {days} {dict.severity.days}
          </span>
          <span className="tnum text-[10px] font-bold text-muted">{formatDistance(report.distance_km)}</span>
        </div>
      </div>
    </Link>
  );
}
