"use client";

import { useEffect, useRef, useState } from "react";
import { AppBar } from "@/components/ui/AppBar";
import { ShareCard, type ShareVariant } from "@/components/screens/ShareCard";
import { useLocale } from "@/components/LocaleProvider";
import { categoryLabel } from "@/lib/categories";

/**
 * ShareCard showcase — renders the three OG variants (1200×630) scaled to fit
 * the column. In production these are generated server-side via an OG route;
 * this page is the visual reference + language preview.
 */
export default function ShareCardPage() {
  const { locale, dict } = useLocale();
  const variants: { v: ShareVariant; label: string }[] = [
    { v: "new", label: "New report (Aqua)" },
    { v: "ignored", label: "Ignored X days (severity red)" },
    { v: "resolved", label: "Resolved 🎉 (mint, before/after)" },
  ];
  return (
    <div className="pb-10">
      <AppBar showWordmark />
      <div className="px-5 pt-4">
        <h1 className="font-display text-[20px] font-black">ShareCard / OG image</h1>
        <p className="mt-1 text-[13px] text-slate">
          1200 × 630 · always anonymized · factual (numbers & status only).
        </p>
      </div>
      <div className="flex flex-col gap-7 px-5 pt-5">
        {variants.map(({ v, label }) => (
          <div key={v}>
            <div className="mb-2 font-display text-[12px] font-extrabold text-slate">{label}</div>
            <ScaledFrame width={1200} height={630}>
              <ShareCard
                variant={v}
                dict={dict}
                category={categoryLabel("illegal_dump", locale)}
                authority="Δήμος Ρόδου"
                place="Φαληράκι"
              />
            </ScaledFrame>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Scales fixed-size content to fit its parent width while preserving ratio. */
function ScaledFrame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="overflow-hidden rounded-[10px] shadow-card" style={{ height: scale ? height * scale : undefined, aspectRatio: scale ? undefined : `${width} / ${height}` }}>
      <div style={{ width, height, transformOrigin: "top left", transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
