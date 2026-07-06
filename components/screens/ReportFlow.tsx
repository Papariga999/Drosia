"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Info,
  Landmark,
  Link2,
  Lock,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Plus,
  RotateCcw,
  Smartphone,
  X,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { PhotoPlaceholder } from "@/components/ui/Photo";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { fill } from "@/lib/i18n";
import { REPORT_CATEGORIES, categoryLabel, type ReportCategory } from "@/lib/categories";
import { MAX_PHOTOS, MAX_DESCRIPTION, MAX_TOTAL_UPLOAD_BYTES } from "@/lib/report-intake";
import { compressImage } from "@/lib/compress-image";
import { getDeviceToken } from "@/lib/device-token";
import { readExifGps, type LatLng } from "@/lib/exif-gps";
import { formatDistance } from "@/lib/geo";
import { reportAgeDays } from "@/lib/severity";
import { trackEvent } from "@/lib/track";
import { canFollow, followReport, type FollowResult } from "@/lib/push/client";

type Step = 1 | 2 | 3 | 4;
type LocSource = "exif" | "gps" | "manual";

/** One row from /api/reports/nearby — an open public report close to the pin. */
interface NearbySuggestion {
  public_token: string;
  category: ReportCategory;
  status: string;
  created_at: string;
  notified_at: string | null;
  resolved_at: string | null;
  photo_url: string | null;
  distance_m: number;
}

/**
 * Report flow (Screen 3) → Success (Screen 4). 4 gated steps with progress
 * dots: photo → location → category+consent → review. The sticky CTA is
 * disabled until each step's requirements are met (inline hint shown).
 *
 * Now wired for real: captures File objects, derives the location from photo
 * EXIF → live GPS → manual entry, and POSTs multipart/form-data to /api/report.
 */
export function ReportFlow() {
  const { locale, dict } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [, setLocSource] = useState<LocSource | null>(null);
  const [locating, setLocating] = useState(false);
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [consent, setConsent] = useState(false);
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // Two inputs, one handler: `capture` forces mobile browsers straight into the
  // camera and never shows the gallery — so the camera-first CTA keeps it, and
  // "upload from gallery" uses a capture-less input (the OS chooser, which
  // offers both gallery and camera). One input can't do both.
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  // Object-URL previews derived from the files; revoked when they change/unmount.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  // Funnel instrumentation (cookieless): entered the flow, and got a location once.
  useEffect(() => {
    trackEvent("report_start");
  }, []);
  const geoFired = useRef(false);
  useEffect(() => {
    if (coords && !geoFired.current) {
      geoFired.current = true;
      trackEvent("geolocate");
    }
  }, [coords]);

  // Pre-submit duplicate check (WO-4): once a location is set, look for open
  // public reports within 100 m so the same pile isn't reported twice.
  // Debounced (map taps fire rapidly), best-effort (a failure never blocks the
  // flow) and skippable — the card is a suggestion, not a gate.
  const [nearby, setNearby] = useState<NearbySuggestion[]>([]);
  const [nearbyDismissed, setNearbyDismissed] = useState(false);
  const [followingNearby, setFollowingNearby] = useState<string | null>(null);
  const nearbyShownFired = useRef(false);
  useEffect(() => {
    // No sync setState here (lint: cascading renders) — stale suggestions are
    // render-guarded by `coords &&` below and reset on flow restart.
    if (!coords) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reports/nearby?lat=${coords.lat}&lng=${coords.lng}`);
        if (!res.ok) return;
        const data = (await res.json()) as { reports?: NearbySuggestion[] };
        const list = data.reports ?? [];
        setNearby(list);
        if (list.length && !nearbyShownFired.current) {
          nearbyShownFired.current = true;
          trackEvent("nearby_dupe_shown");
        }
      } catch {
        /* suggestion is best-effort */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [coords]);

  // "It's the same" → follow the existing report (Web-Push where supported)
  // and hand over to its tracking page instead of creating a duplicate.
  async function followNearby(r: NearbySuggestion) {
    setFollowingNearby(r.public_token);
    trackEvent("nearby_dupe_follow", { reportToken: r.public_token });
    try {
      if (canFollow()) await followReport(r.public_token);
    } finally {
      router.push(`/r/${r.public_token}`);
    }
  }

  async function addFiles(picked: FileList | null) {
    const list = Array.from(picked ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    // EXIF GPS must come from the ORIGINAL — compression strips metadata.
    if (!coords && list[0]) {
      readExifGps(list[0]).then((g) => {
        if (g) {
          setCoords(g);
          setLocSource("exif");
        }
      });
    }
    // Compress in the browser: Vercel caps request bodies at ~4.5 MB, so raw
    // phone photos must shrink before upload (also converts iOS HEIC → JPEG).
    const compressed = await Promise.all(list.map(compressImage));
    setFiles((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS));
    setError(null);
    trackEvent("photo_added");
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocSource("gps");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const canSubmit = files.length >= 1 && !!coords && !!cat && consent;
  const canNext =
    step === 1 ? files.length >= 1 : step === 2 ? !!coords : step === 3 ? !!cat && consent : canSubmit;
  const hint = !canNext
    ? step === 1
      ? dict.flow.hintPhoto
      : step === 2
        ? dict.flow.hintLocation
        : !cat
          ? dict.flow.hintCat
          : dict.flow.hintConsent
    : "";

  // Handover 1c: the validation hint appears only AFTER tapping the disabled
  // Continue — never by default. Tracking WHICH step was tapped (rather than a
  // boolean) makes the hint vanish on step change or once the requirement is
  // met, with no effect needed.
  const [hintStep, setHintStep] = useState<Step | null>(null);
  const showHint = hintStep === step && !canNext;

  async function submit() {
    if (!canSubmit || submitting) return;
    // Hard platform bound: Vercel refuses bodies over ~4.5 MB with a 413 that
    // never reaches our route — catch it here with an actionable message.
    if (files.reduce((s, f) => s + f.size, 0) > MAX_TOTAL_UPLOAD_BYTES) {
      setError(dict.flow.errTooLarge);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("photos", f));
      fd.append("lat", String(coords!.lat));
      fd.append("lng", String(coords!.lng));
      fd.append("category", cat!);
      fd.append("description", desc);
      fd.append("locale", locale);
      fd.append("consent", "true");
      fd.append("authorToken", getDeviceToken());
      fd.append("website", ""); // honeypot
      const res = await fetch("/api/report", { method: "POST", body: fd });
      if (res.status === 201) {
        const data = (await res.json()) as { token: string };
        trackEvent("submit_success", { reportToken: data.token });
        setToken(data.token);
        return;
      }
      trackEvent("submit_fail");
      setError(
        res.status === 422
          ? dict.flow.errBounds
          : res.status === 429
            ? dict.flow.errRate
            : res.status === 503
              ? dict.flow.errBackend
              : dict.flow.errGeneric,
      );
    } catch {
      trackEvent("submit_fail");
      setError(dict.flow.errGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!canNext) {
      setHintStep(step);
      return;
    }
    if (step < 4) setStep((s) => (s + 1) as Step);
    else void submit();
  }

  if (token)
    return (
      <SuccessView
        token={token}
        photoUrl={previews[0] ?? null}
        onRestart={() => {
          setStep(1);
          setFiles([]);
          setCoords(null);
          setLocSource(null);
          setCat(null);
          setConsent(false);
          setDesc("");
          setToken(null);
          setNearby([]);
          setNearbyDismissed(false);
          setFollowingNearby(null);
        }}
        onMap={() => router.push("/map")}
      />
    );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Flow header */}
      <div className="flex items-center gap-3 px-5 pt-4">
        <button
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.push("/"))}
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface-card text-slate"
          aria-label={dict.common.back}
        >
          ‹
        </button>
        <h1 className="font-display text-[17px] font-black">{dict.flow.title}</h1>
        <span className="ml-auto" />
        <LangSwitch />
      </div>
      <StepIndicator
        step={step}
        labels={[dict.flow.stepPhoto, dict.flow.stepLocation, dict.flow.stepCategory, dict.flow.stepSend]}
      />


      <div className="flex-1 px-5">
        {step === 1 && (
          <div>
            <StepTitle title={dict.flow.s1Title} sub={dict.flow.s1Sub} />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex h-[200px] w-full flex-col rounded-[20px] border-2 border-dashed border-primary/50 bg-tint-soft">
              <button
                onClick={() => cameraInput.current?.click()}
                className="flex w-full flex-1 flex-col items-center justify-center gap-2.5"
              >
                <Camera size={38} className="text-primary-ink" aria-hidden />
                <div className="font-display text-[15px] font-extrabold text-primary-ink">{dict.flow.s1Cta}</div>
              </button>
              <button
                onClick={() => galleryInput.current?.click()}
                className="pb-4 text-[12px] text-slate underline underline-offset-2"
              >
                {dict.flow.s1Hint}
              </button>
            </div>
            <div className="mt-3.5 flex gap-2.5">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 overflow-hidden rounded-[14px] border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setFiles((f) => f.filter((_, idx) => idx !== i))}
                    aria-label={dict.flow.removePhoto}
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink-fixed/80 text-white"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && (
                <button
                  onClick={() => galleryInput.current?.click()}
                  aria-label={dict.flow.s1Hint}
                  className="grid h-20 w-20 place-items-center rounded-[14px] border-[1.5px] border-dashed border-line-strong bg-surface text-primary/50"
                >
                  <Plus size={22} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-2.5 text-[12px] text-muted">{fill(dict.flow.photoCount, { n: files.length })}</div>

            {/* Photo-example strip (1c) — static teaching content, no ML. */}
            <div className="mt-4">
              <div className="text-[12px] font-bold text-slate">{dict.flow.exampleTitle}</div>
              <div className="mt-2 flex gap-2">
                <ExampleTile kind="good" label={dict.flow.exGood} />
                <ExampleTile kind="far" label={dict.flow.exFar} />
                <ExampleTile kind="dark" label={dict.flow.exDark} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepTitle title={dict.flow.s2Title} sub={dict.flow.s2Sub} />
            {coords && (
              <span className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[12px] font-bold text-primary-ink">
                <CheckCircle2 size={14} aria-hidden /> {dict.flow.locDetected}
              </span>
            )}
            <div className="relative h-[240px] overflow-hidden rounded-[20px] border border-line-strong">
              <DrosiaMap
                points={
                  coords
                    ? [{ lat: coords.lat, lng: coords.lng, color: "var(--primary)", title: dict.flow.locDetected }]
                    : []
                }
                center={coords ? [coords.lat, coords.lng] : undefined}
                zoom={coords ? 15 : undefined}
                fitToMarkers={false}
                interactive
                showAttribution={false}
                showZoomControl
                onMapClick={(p) => {
                  setLocSource("manual");
                  setCoords({ lat: p.lat, lng: p.lng });
                }}
                className="absolute inset-0"
                ariaLabel={dict.flow.s2Title}
              />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface-card/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate">
                {coords ? (
                  <span className="tnum inline-flex items-center gap-1">
                    <MapPin size={12} aria-hidden /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </span>
                ) : (
                  dict.flow.locNone
                )}
              </div>
            </div>

            <button
              onClick={useCurrentLocation}
              disabled={locating}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-surface-card px-3 py-3 font-display text-[14px] font-extrabold text-primary-ink disabled:opacity-60"
            >
              <LocateFixed size={17} aria-hidden /> {locating ? dict.flow.locating : dict.flow.useLocation}
            </button>

            {/* Possible duplicates (WO-4) — skippable suggestion, never a gate. */}
            {coords && nearby.length > 0 && !nearbyDismissed && (
              <div className="mt-3.5 rounded-2xl border-[1.5px] border-accent bg-surface-card p-3.5">
                <div className="font-display text-[14px] font-extrabold">{dict.flow.nearbyTitle}</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate">{dict.flow.nearbySub}</p>
                <div className="mt-2.5 flex flex-col gap-2">
                  {nearby.map((r) => (
                    <div key={r.public_token} className="flex items-center gap-2.5 rounded-xl border border-line p-2">
                      {r.photo_url ? (
                        <div className="h-12 w-12 flex-none overflow-hidden rounded-[10px] border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.photo_url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <PhotoPlaceholder className="h-12 w-12 flex-none rounded-[10px]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[13px] font-bold">
                          <CategoryIcon category={r.category} size={15} className="flex-none text-primary-ink" />
                          <span className="truncate">{categoryLabel(r.category, locale)}</span>
                        </div>
                        <div className="tnum text-[11px] text-muted">
                          {reportAgeDays(r)} {dict.severity.days} · {formatDistance(r.distance_m / 1000)}
                        </div>
                      </div>
                      <button
                        onClick={() => followNearby(r)}
                        disabled={followingNearby !== null}
                        className="flex-none rounded-[10px] border border-primary bg-tint px-2.5 py-2 text-[12px] font-bold text-primary-ink disabled:opacity-60"
                      >
                        {followingNearby === r.public_token ? dict.common.loading : dict.flow.nearbySame}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNearbyDismissed(true)}
                  className="mt-2.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] font-bold text-slate"
                >
                  {dict.flow.nearbyNew}
                </button>
              </div>
            )}

            <div className="mt-3 text-center text-[12px] font-bold text-muted">{dict.flow.tapHint}</div>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepTitle title={dict.flow.s3Title} sub={dict.flow.s3Sub} />
            <div className="flex flex-wrap gap-2">
              {REPORT_CATEGORIES.map((c) => {
                const sel = cat === c;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    aria-pressed={sel}
                    className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-2 text-[13px] font-bold transition-colors ${
                      sel ? "border-primary bg-tint text-ink" : "border-line-strong bg-surface text-slate"
                    }`}
                  >
                    <CategoryIcon category={c} size={17} className={sel ? "text-primary-ink" : "text-slate"} />
                    {categoryLabel(c, locale)}
                  </button>
                );
              })}
            </div>
            <div className="relative mt-4">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value.slice(0, MAX_DESCRIPTION))}
                placeholder={dict.flow.s3Placeholder}
                className="h-[90px] w-full resize-none rounded-[14px] border-[1.5px] border-line-strong bg-surface-card p-3 text-[14px] outline-none focus:border-primary"
              />
              <div className="tnum absolute bottom-2.5 right-3 text-[11px] text-muted">
                {desc.length} / {MAX_DESCRIPTION}
              </div>
            </div>
            <button
              onClick={() => setConsent((v) => !v)}
              className="mt-3.5 flex w-full gap-3 rounded-2xl border-[1.5px] p-3.5 text-left transition-colors"
              style={{
                background: consent ? "#EAFBF1" : "var(--surface)",
                borderColor: consent ? "var(--success)" : "var(--border-strong)",
              }}
            >
              <span
                className="grid h-6 w-6 flex-none place-items-center rounded-[7px] border-2 text-white"
                style={{
                  borderColor: consent ? "var(--success)" : "var(--muted)",
                  background: consent ? "var(--success)" : "transparent",
                }}
              >
                {consent && <Check size={15} aria-hidden />}
              </span>
              <span className="text-[12px] leading-relaxed text-slate">{dict.flow.consent}</span>
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <StepTitle title={dict.flow.s4Title} sub={dict.flow.s4Sub} />
            <div className="mb-2.5 flex items-center gap-3 rounded-2xl border border-line p-3">
              {previews[0] ? (
                <div className="h-16 w-16 flex-none overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previews[0]} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <PhotoPlaceholder className="h-16 w-16 flex-none rounded-xl" />
              )}
              <div>
                <div className="flex items-center gap-1.5 font-display text-[14px] font-extrabold">
                  {cat ? (
                    <>
                      <CategoryIcon category={cat} size={16} className="text-primary-ink" /> {categoryLabel(cat, locale)}
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="tnum flex items-center gap-1 text-[12px] text-slate">
                  <MapPin size={12} aria-hidden /> {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-tint-soft p-3.5">
              <Landmark size={22} className="flex-none text-primary-ink" aria-hidden />
              <div>
                <div className="text-[12px] text-slate">{dict.flow.s4Auth}</div>
              </div>
            </div>
            <p className="mt-3.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted">
              <Lock size={13} className="mt-0.5 flex-none" aria-hidden /> {dict.flow.s4Note}
            </p>
          </div>
        )}
      </div>

      {/* Sticky footer CTA. The "disabled" state stays tappable so the first
          tap can reveal the validation hint (1c) — never shown by default. */}
      <div className="sticky bottom-0 border-t border-line bg-surface-card px-5 pb-5 pt-3.5">
        <button
          onClick={next}
          disabled={submitting}
          aria-disabled={!canNext || submitting}
          className="w-full rounded-2xl px-4 py-4 font-display text-[16px] font-extrabold transition-all"
          style={{
            background: canNext && !submitting ? "var(--primary)" : "var(--border)",
            color: canNext && !submitting ? "#fff" : "var(--muted)",
            boxShadow: canNext && !submitting ? "var(--shadow-btn)" : "none",
          }}
        >
          {submitting ? dict.flow.submitting : step < 4 ? dict.flow.continue : dict.flow.send}
        </button>
        {error && <div className="mt-2 text-center text-[12px] font-bold text-severity-stale">{error}</div>}
        {!error && showHint && hint && (
          <div className="mt-2 flex items-center justify-center gap-1.5 text-center text-[12px] font-bold" style={{ color: "#B7820E" }}>
            <Info size={14} className="flex-none" aria-hidden /> {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pt-1">
      <h2 className="font-display text-[21px] font-black">{title}</h2>
      <p className="mb-3.5 mt-1 text-[13px] text-slate">{sub}</p>
    </div>
  );
}

/**
 * Labeled step indicator (1c) replacing "Step 1 of 4": numbered dots with
 * labels connected by progress lines — done/current = aqua, upcoming = outline.
 */
function StepIndicator({ step, labels }: { step: Step; labels: [string, string, string, string] }) {
  return (
    <div className="flex items-start px-4 pb-4 pt-3" aria-label={labels[step - 1]}>
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const current = step === n;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div
                className="mt-[12px] h-[2px] min-w-3 flex-1"
                style={{ background: step >= n ? "var(--primary)" : "var(--border-strong)" }}
              />
            )}
            <div className="flex flex-col items-center gap-1 px-1">
              <div
                className="grid h-[26px] w-[26px] place-items-center rounded-full border-2 font-display text-[12px] font-black"
                style={{
                  background: done || current ? "var(--primary)" : "var(--surface-card)",
                  borderColor: done || current ? "var(--primary)" : "var(--border-strong)",
                  color: done || current ? "#fff" : "var(--muted)",
                  boxShadow: current ? "0 0 0 4px var(--tint)" : "none",
                }}
              >
                {done ? <Check size={14} aria-hidden /> : n}
              </div>
              <div
                className="max-w-[64px] text-center text-[10px] font-bold leading-tight"
                style={{ color: current ? "var(--primary-ink)" : done ? "var(--ink)" : "var(--muted)" }}
              >
                {label}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * "What a good photo looks like" strip (1c) — static teaching thumbnails
 * (gradient placeholders per handover; real photos come from reports).
 */
function ExampleTile({ kind, label }: { kind: "good" | "far" | "dark"; label: string }) {
  const good = kind === "good";
  const scene =
    kind === "dark"
      ? "linear-gradient(160deg,#22333a,#0d181d)"
      : "repeating-linear-gradient(135deg,rgba(11,43,48,0.10) 0 10px,transparent 10px 22px),linear-gradient(160deg,#c9dee1,#a9c6cb)";
  return (
    <div className="flex-1">
      <div
        className="relative h-[62px] overflow-hidden rounded-[10px]"
        style={{
          background: scene,
          border: good ? "2px solid var(--success)" : "1px solid var(--border-strong)",
        }}
      >
        {/* "subject" block — big & centered when close, tiny when far */}
        <div
          className="absolute rounded-[3px]"
          style={
            kind === "far"
              ? { left: "44%", top: "40%", width: 10, height: 8, background: "rgba(11,43,48,0.45)" }
              : { left: "28%", top: "22%", width: "44%", height: "56%", background: "rgba(11,43,48,0.45)" }
          }
        />
        <span
          className="absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full text-white"
          style={{ background: good ? "var(--success)" : "var(--muted)" }}
        >
          {good ? <Check size={11} aria-hidden /> : <X size={11} aria-hidden />}
        </span>
      </div>
      <div className="mt-1 text-center text-[10px] font-bold" style={{ color: good ? "var(--success)" : "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

function SuccessView({
  token,
  photoUrl,
  onRestart,
  onMap,
}: {
  token: string;
  photoUrl: string | null;
  onRestart: () => void;
  onMap: () => void;
}) {
  const { dict } = useLocale();
  const [copied, setCopied] = useState(false);
  const [follow, setFollow] = useState<FollowResult | "idle" | "loading">("idle");

  // Client-only view (rendered after submit), so window is available.
  const reportUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${token}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${dict.success.shareTitle} ${reportUrl}`)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(reportUrl)}`;

  function copyLink() {
    navigator.clipboard?.writeText(reportUrl).catch(() => {});
    trackEvent("share_click", { reportToken: token, shareChannel: "copy" });
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="px-5 pb-8 pt-5 text-center">
      <div className="relative mx-auto grid h-21 w-21 place-items-center" style={{ width: 84, height: 84 }}>
        <div className="grid h-21 w-21 place-items-center rounded-full bg-[#EAFBF1] text-success" style={{ width: 84, height: 84 }}>
          <CheckCircle2 size={44} aria-hidden />
        </div>
      </div>
      <h1 className="mt-3.5 font-display text-[24px] font-black tracking-display">{dict.success.title}</h1>
      <p className="mt-1.5 text-[14px] text-slate">{dict.success.sub}</p>

      <a
        href={`/r/${token}`}
        className="mt-4 block rounded-[14px] bg-ink py-3 text-center font-display text-[14px] font-extrabold text-ink-contrast"
      >
        {dict.success.track} ›
      </a>

      {/* ShareCard prominent */}
      <div className="mt-4 overflow-hidden rounded-[18px] text-left shadow-card">
        <div className="flex items-center gap-3 bg-primary p-4 text-white">
          {/* The reporter's own local preview (never uploaded to a public
              surface here) — the shared /r/ page shows only the anonymized
              variant once published. */}
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-[60px] w-[60px] flex-none rounded-xl object-cover" />
          ) : (
            <PhotoPlaceholder className="h-[60px] w-[60px] flex-none rounded-xl" />
          )}
          <div className="flex-1">
            <div className="font-display text-[15px] font-black">{dict.success.shareTitle}</div>
            <div className="text-[12px] opacity-90">{dict.success.shareSub}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 bg-surface-card p-3">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("share_click", { reportToken: token, shareChannel: "whatsapp" })}
            className="flex h-[42px] min-w-[100px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-bold"
          >
            WhatsApp
          </a>
          <a
            href={facebookHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("share_click", { reportToken: token, shareChannel: "facebook" })}
            className="flex h-[42px] min-w-[100px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-bold"
          >
            Facebook
          </a>
          {/* Copy for everything else (Reddit, Instagram DMs, email, …). */}
          <button
            onClick={copyLink}
            className="flex h-[42px] min-w-[100px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary bg-tint text-[13px] font-bold text-primary-ink"
          >
            <Link2 size={15} aria-hidden /> {copied ? dict.common.copied : dict.common.copyLink}
          </button>
        </div>
      </div>

      {/* Follow via Web-Push — keyed by the anonymous device token, no email.
          Only shown when the browser + a configured VAPID key support it. */}
      {canFollow() && follow !== "followed" && (
        <button
          onClick={async () => {
            setFollow("loading");
            setFollow(await followReport(token));
          }}
          disabled={follow === "loading"}
          className="mt-3.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-card p-3.5 text-left disabled:opacity-60"
        >
          <Bell size={22} className="flex-none text-primary-ink" aria-hidden />
          <div className="flex-1">
            <div className="text-[13px] font-bold">{dict.success.follow}</div>
            <div className="text-[12px] text-muted">{dict.success.followSub}</div>
          </div>
          <span className="font-display text-[13px] font-extrabold text-primary-ink">
            {follow === "loading" ? dict.common.loading : dict.success.followCta}
          </span>
        </button>
      )}
      {follow === "followed" && (
        <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[13px] font-bold text-success">
          <Bell size={15} aria-hidden /> {dict.tracking.following}
        </div>
      )}
      {(follow === "denied" || follow === "error") && (
        <div className="mt-2 text-center text-[12px] text-muted">{dict.tracking.followDesc}</div>
      )}

      <button
        onClick={onMap}
        className="mt-3.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-card p-3.5 text-left"
      >
        <MapIcon size={22} className="flex-none text-primary-ink" aria-hidden />
        <div className="flex-1 text-[13px] font-bold">{dict.success.nearby}</div>
        <span className="text-[18px] text-muted">›</span>
      </button>

      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <Smartphone size={14} aria-hidden /> {dict.success.pwa}
      </div>

      <button
        onClick={onRestart}
        className="mt-4 inline-flex items-center gap-1.5 font-display text-[13px] font-extrabold text-primary-ink underline"
      >
        <RotateCcw size={13} aria-hidden /> {dict.success.again}
      </button>
    </div>
  );
}
