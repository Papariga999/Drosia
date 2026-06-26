import type { Dict } from "@/lib/i18n";

/**
 * ShareCard / OG image — 1200×630, always anonymized, factual (numbers + status
 * only). Three variants per the design handoff:
 *   new      → Aqua, neutral ("Just reported")
 *   ignored  → severity red, big day count (pressure)
 *   resolved → mint, before/after split ("Fixed after N days")
 * Inline styles are kept Satori-friendly so the same markup can drive an
 * OG ImageResponse route.
 */
export type ShareVariant = "new" | "ignored" | "resolved";

const SCENE =
  "repeating-linear-gradient(135deg,#9fb89a 0 18px,#8aa886 18px 36px),linear-gradient(180deg,#b9cdb0,#7e9a86)";
const PIX =
  "repeating-linear-gradient(0deg,rgba(55,55,55,.6) 0 9px,rgba(110,110,110,.6) 9px 18px),repeating-linear-gradient(90deg,rgba(40,40,40,.35) 0 9px,transparent 9px 18px)";

function Mark({ size = 40, drop = "#00B4C8", hole = "#F2FBFC" }: { size?: number; drop?: string; hole?: string }) {
  return (
    <svg width={size} height={(size * 64) / 48} viewBox="0 0 48 64" fill="none">
      <path d="M24 3C13.5 3 5 11.3 5 21.6 5 35 24 61 24 61s19-26 19-39.4C43 11.3 34.5 3 24 3Z" fill={drop} />
      <circle cx="24" cy="21" r="8.4" fill={hole} />
    </svg>
  );
}

export function ShareCard({
  variant,
  dict,
  category,
  authority,
  place,
  days = 47,
  resolvedDays = 12,
  token = "k7m2x",
}: {
  variant: ShareVariant;
  dict: Dict;
  category: string;
  authority: string;
  place: string;
  days?: number;
  resolvedDays?: number;
  token?: string;
}) {
  const url = `drosia.eu/r/${token}`;

  if (variant === "ignored") {
    return (
      <div style={{ width: 1200, height: 630, display: "flex", background: "linear-gradient(155deg,#E74C3C,#B83227)", fontFamily: "Mulish, sans-serif" }}>
        <div style={{ width: 480, height: "100%", flex: "none", background: SCENE, position: "relative", filter: "saturate(0.7) brightness(0.82)" }}>
          <div style={{ position: "absolute", left: 250, bottom: 210, width: 120, height: 88, borderRadius: 6, backgroundImage: PIX }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 60%,rgba(184,50,39,0.9))" }} />
        </div>
        <div style={{ flex: 1, padding: "48px 54px", display: "flex", flexDirection: "column", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mark size={38} drop="#fff" hole="#E74C3C" />
            <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 32, letterSpacing: "-0.02em" }}>Drosia</span>
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 700, fontSize: 26, opacity: 0.92 }}>⏱ {dict.share.ignoredLabel}</div>
            <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 200, lineHeight: 0.92, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>{days}</div>
            <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 46 }}>{dict.share.ignoredHead}</div>
            <div style={{ fontWeight: 600, fontSize: 22, opacity: 0.92, marginTop: 12 }}>🗑 {category} · 🏛 {authority}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 19, opacity: 0.85, marginTop: 30 }}>{url}</div>
        </div>
      </div>
    );
  }

  if (variant === "resolved") {
    return (
      <div style={{ width: 1200, height: 630, display: "flex", background: "linear-gradient(155deg,#2ECC71,#1B9E54)", fontFamily: "Mulish, sans-serif" }}>
        <div style={{ width: 560, height: "100%", flex: "none", position: "relative", display: "flex" }}>
          <div style={{ width: "50%", height: "100%", background: SCENE, position: "relative", filter: "saturate(0.65) brightness(0.85)" }}>
            <div style={{ position: "absolute", left: 110, bottom: 200, width: 90, height: 70, borderRadius: 6, backgroundImage: PIX }} />
            <div style={{ position: "absolute", left: 18, top: 18, background: "rgba(11,43,48,0.7)", color: "#fff", fontWeight: 700, fontSize: 15, padding: "6px 13px", borderRadius: 999 }}>{dict.share.before}</div>
          </div>
          <div style={{ width: "50%", height: "100%", background: "linear-gradient(180deg,#cdeED7,#a7e6c0)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "absolute", right: 18, top: 18, background: "#fff", color: "#1B8B4A", fontWeight: 700, fontSize: 15, padding: "6px 13px", borderRadius: 999 }}>{dict.share.after}</div>
            <div style={{ fontSize: 60 }}>✨</div>
          </div>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 4, background: "#fff", transform: "translateX(-50%)" }} />
        </div>
        <div style={{ flex: 1, padding: "50px 54px", display: "flex", flexDirection: "column", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mark size={38} drop="#fff" hole="#2ECC71" />
            <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 32, letterSpacing: "-0.02em" }}>Drosia</span>
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 54 }}>🎉</div>
            <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 58, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "8px 0 14px" }}>{dict.share.resolvedHead}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, background: "rgba(255,255,255,0.2)", padding: "14px 24px", borderRadius: 18, alignSelf: "flex-start" }}>
              <span style={{ fontWeight: 700, fontSize: 22 }}>{dict.share.resolvedAfter}</span>
              <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 48, fontVariantNumeric: "tabular-nums" }}>{resolvedDays}</span>
              <span style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: 24 }}>{dict.severity.days}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 22, opacity: 0.95, marginTop: 16 }}>🏛 {authority}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 19, opacity: 0.9, marginTop: 30 }}>{url}</div>
        </div>
      </div>
    );
  }

  // variant === "new"
  return (
    <div style={{ width: 1200, height: 630, display: "flex", background: "#fff", fontFamily: "Mulish, sans-serif" }}>
      <div style={{ width: 560, height: "100%", flex: "none", background: SCENE, position: "relative" }}>
        <div style={{ position: "absolute", left: 300, bottom: 200, width: 120, height: 88, borderRadius: 6, backgroundImage: PIX }} />
        <div style={{ position: "absolute", left: 28, top: 28, background: "rgba(11,43,48,0.82)", color: "#fff", fontWeight: 700, fontSize: 18, padding: "9px 16px", borderRadius: 999 }}>🗑 {category}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(transparent,rgba(11,43,48,0.55))", padding: 28, color: "#fff", fontWeight: 600, fontSize: 18 }}>🔒 {dict.share.anon}</div>
      </div>
      <div style={{ flex: 1, padding: "50px 54px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark size={40} />
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 34, color: "#0B2B30", letterSpacing: "-0.02em" }}>Drosia</span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ background: "#E0F3F5", color: "#00A6BC", fontFamily: "Nunito", fontWeight: 800, fontSize: 22, padding: "10px 20px", borderRadius: 999 }}>{dict.share.newBadge}</div>
          <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 60, lineHeight: 1.05, color: "#0B2B30", letterSpacing: "-0.02em", margin: "22px 0 10px" }}>{dict.share.newHead}</div>
          <div style={{ fontWeight: 600, fontSize: 24, color: "#5B7378" }}>🏛 {authority} · {place}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 40 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "#F0FAFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mark size={22} hole="#fff" />
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#9DB1B5" }}>{url}</div>
        </div>
      </div>
    </div>
  );
}
