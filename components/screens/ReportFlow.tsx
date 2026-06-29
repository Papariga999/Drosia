"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { PhotoPlaceholder } from "@/components/ui/Photo";
import { DrosiaMap } from "@/components/maps/DrosiaMap";
import { fill } from "@/lib/i18n";
import { REPORT_CATEGORIES, CATEGORY_META, categoryLabel, type ReportCategory } from "@/lib/categories";
import { MAX_PHOTOS, MAX_DESCRIPTION } from "@/lib/report-intake";
import { getDeviceToken } from "@/lib/device-token";
import { readExifGps, type LatLng } from "@/lib/exif-gps";
import { trackEvent } from "@/lib/track";

type Step = 1 | 2 | 3 | 4;
type LocSource = "exif" | "gps" | "manual";

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
  const fileInput = useRef<HTMLInputElement>(null);

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

  function addFiles(picked: FileList | null) {
    const list = Array.from(picked ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const merged = [...files, ...list].slice(0, MAX_PHOTOS);
    setFiles(merged);
    setError(null);
    trackEvent("photo_added");
    if (!coords && merged[0]) {
      readExifGps(merged[0]).then((g) => {
        if (g) {
          setCoords(g);
          setLocSource("exif");
        }
      });
    }
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

  async function submit() {
    if (!canSubmit || submitting) return;
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
    if (!canNext) return;
    if (step < 4) setStep((s) => (s + 1) as Step);
    else void submit();
  }

  if (token)
    return (
      <SuccessView
        token={token}
        onRestart={() => {
          setStep(1);
          setFiles([]);
          setCoords(null);
          setLocSource(null);
          setCat(null);
          setConsent(false);
          setDesc("");
          setToken(null);
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
        <span className="tnum ml-auto text-[12px] font-bold text-muted">
          {dict.flow.step} {step} {dict.flow.of} 4
        </span>
        <LangSwitch />
      </div>
      <div className="flex gap-1.5 px-5 pb-3 pt-3">
        {[1, 2, 3, 4].map((d) => (
          <div
            key={d}
            className="h-[5px] flex-1 rounded-full"
            style={{ background: step >= d ? "var(--primary)" : "var(--border-strong)" }}
          />
        ))}
      </div>

      <div className="flex-1 px-5">
        {step === 1 && (
          <div>
            <StepTitle title={dict.flow.s1Title} sub={dict.flow.s1Sub} />
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              className="flex h-[200px] w-full flex-col items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed border-primary/50 bg-tint-soft"
            >
              <div className="text-4xl">📷</div>
              <div className="font-display text-[15px] font-extrabold text-primary-ink">{dict.flow.s1Cta}</div>
              <div className="text-[12px] text-slate">{dict.flow.s1Hint}</div>
            </button>
            <div className="mt-3.5 flex gap-2.5">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 overflow-hidden rounded-[14px] border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setFiles((f) => f.filter((_, idx) => idx !== i))}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink-fixed/80 text-[12px] text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileInput.current?.click()}
                  className="h-20 w-20 rounded-[14px] border-[1.5px] border-dashed border-line-strong bg-surface text-[22px] text-primary/50"
                >
                  ＋
                </button>
              )}
            </div>
            <div className="mt-2.5 text-[12px] text-muted">{fill(dict.flow.photoCount, { n: files.length })}</div>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepTitle title={dict.flow.s2Title} sub={dict.flow.s2Sub} />
            {coords && (
              <span className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[12px] font-bold text-primary-ink">
                ✅ {dict.flow.locDetected}
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
                  <span className="tnum">
                    📌 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
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
              🎯 {locating ? dict.flow.locating : dict.flow.useLocation}
            </button>

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
                    className={`rounded-full border-[1.5px] px-3 py-2 text-[13px] font-bold transition-colors ${
                      sel ? "border-primary bg-tint text-ink" : "border-line-strong bg-surface text-slate"
                    }`}
                  >
                    {CATEGORY_META[c].emoji} {categoryLabel(c, locale)}
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
                className="grid h-6 w-6 flex-none place-items-center rounded-[7px] border-2 text-[15px] text-white"
                style={{
                  borderColor: consent ? "var(--success)" : "var(--muted)",
                  background: consent ? "var(--success)" : "transparent",
                }}
              >
                {consent ? "✓" : ""}
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
                <div className="font-display text-[14px] font-extrabold">
                  {cat ? `${CATEGORY_META[cat].emoji} ${categoryLabel(cat, locale)}` : "—"}
                </div>
                <div className="tnum text-[12px] text-slate">
                  📍 {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-tint-soft p-3.5">
              <div className="text-[22px]">🏛</div>
              <div>
                <div className="text-[12px] text-slate">{dict.flow.s4Auth}</div>
              </div>
            </div>
            <p className="mt-3.5 text-[12px] leading-relaxed text-muted">🔒 {dict.flow.s4Note}</p>
          </div>
        )}
      </div>

      {/* Sticky footer CTA */}
      <div className="sticky bottom-0 border-t border-line bg-surface-card px-5 pb-5 pt-3.5">
        <button
          onClick={next}
          disabled={!canNext || submitting}
          className="w-full rounded-2xl px-4 py-4 font-display text-[16px] font-extrabold transition-all"
          style={{
            background: canNext && !submitting ? "var(--primary)" : "var(--border)",
            color: canNext && !submitting ? "#fff" : "var(--muted)",
            boxShadow: canNext && !submitting ? "var(--shadow-btn)" : "none",
            cursor: canNext && !submitting ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? dict.flow.submitting : step < 4 ? dict.flow.continue : dict.flow.send}
        </button>
        {error && <div className="mt-2 text-center text-[12px] font-bold text-severity-stale">{error}</div>}
        {!error && hint && <div className="mt-2 text-center text-[12px] text-severity-stale">{hint}</div>}
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

function SuccessView({ token, onRestart, onMap }: { token: string; onRestart: () => void; onMap: () => void }) {
  const { dict } = useLocale();

  return (
    <div className="px-5 pb-8 pt-5 text-center">
      <div className="relative mx-auto grid h-21 w-21 place-items-center" style={{ width: 84, height: 84 }}>
        <div className="grid h-21 w-21 place-items-center rounded-full bg-[#EAFBF1] text-[42px]" style={{ width: 84, height: 84 }}>
          ✅
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
          <PhotoPlaceholder className="h-[60px] w-[60px] flex-none rounded-xl" />
          <div className="flex-1">
            <div className="font-display text-[15px] font-black">{dict.success.shareTitle}</div>
            <div className="text-[12px] opacity-90">{dict.success.shareSub}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 bg-surface-card p-3">
          <div className="flex h-[42px] min-w-[100px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-bold">
            WhatsApp
          </div>
          <div className="flex h-[42px] min-w-[100px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-bold">
            Facebook
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-tint-soft p-3.5 text-left">
        <div className="text-2xl">🔔</div>
        <div className="flex-1">
          <div className="font-display text-[14px] font-extrabold">{dict.success.follow}</div>
          <div className="text-[12px] text-slate">{dict.success.followSub}</div>
        </div>
        <button className="rounded-[10px] bg-primary px-3.5 py-2 font-display text-[13px] font-extrabold text-white">
          {dict.success.followCta}
        </button>
      </div>

      <button
        onClick={onMap}
        className="mt-3.5 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-card p-3.5 text-left"
      >
        <div className="text-[22px]">🗺</div>
        <div className="flex-1 text-[13px] font-bold">{dict.success.nearby}</div>
        <span className="text-[18px] text-muted">›</span>
      </button>

      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[12px] text-muted">📲 {dict.success.pwa}</div>

      <button onClick={onRestart} className="mt-4 font-display text-[13px] font-extrabold text-primary-ink underline">
        ↺ {dict.success.again}
      </button>
    </div>
  );
}
