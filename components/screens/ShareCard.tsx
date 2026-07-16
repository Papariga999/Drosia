import type { Dict } from "@/lib/i18n";
import { SITE_HOST } from "@/lib/site-url";

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
  const url = `${SITE_HOST}/r/${token}`;

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
            <div style={{ fontWeight: 700, fontSize: 26, opacity: 0.92 }}>{dict.share.ignoredLabel}</div>
            <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 200, lineHeight: 0.92, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>{days}</div>
            <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 46 }}>{dict.share.ignoredHead}</div>
            <div style={{ fontWeight: 600, fontSize: 22, opacity: 0.92, marginTop: 12 }}>{category} · {authority}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 19, opacity: 0.85, marginTop: 30 }}>{url}</div>
        </div>
      </div>
    );
  }

  if (variant === "resolved") {
    // Handover 1g: night-teal gradient, ripple circles bottom-right, wordmark +
    // "Fixed ✓" mint badge, before/after with date badges, days in mint,
    // credit line for reporter AND authority, footer URL + claim.
    return (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(135deg,#07232A,#0E3A42)",
          fontFamily: "Mulish, sans-serif",
          color: "#fff",
          padding: "44px 54px",
          overflow: "hidden",
        }}
      >
        {/* faint ripple circles bottom-right */}
        <div style={{ position: "absolute", right: -140, bottom: -160, width: 420, height: 420, borderRadius: 999, border: "2px solid rgba(0,180,200,0.18)", display: "flex" }} />
        <div style={{ position: "absolute", right: -60, bottom: -80, width: 260, height: 260, borderRadius: 999, border: "2px solid rgba(0,180,200,0.14)", display: "flex" }} />
        <div style={{ position: "absolute", right: 10, bottom: -10, width: 130, height: 130, borderRadius: 999, border: "2px solid rgba(0,180,200,0.10)", display: "flex" }} />

        {/* header: wordmark + Fixed badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark size={36} drop="#00B4C8" hole="#07232A" />
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 32, letterSpacing: "-0.02em" }}>Drosia</span>
          <span style={{ display: "flex", alignItems: "center", marginLeft: 18, background: "#2ECC71", color: "#07232A", fontFamily: "Nunito", fontWeight: 900, fontSize: 22, padding: "8px 20px", borderRadius: 999 }}>
            {dict.share.fixedBadge} ✓
          </span>
        </div>

        {/* before/after strip with date badges */}
        <div style={{ display: "flex", gap: 18, marginTop: 32 }}>
          <div style={{ width: 400, height: 260, borderRadius: 22, background: SCENE, position: "relative", display: "flex", filter: "saturate(0.65) brightness(0.8)", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 130, bottom: 90, width: 110, height: 80, borderRadius: 6, backgroundImage: PIX, display: "flex" }} />
            <div style={{ position: "absolute", left: 16, top: 16, background: "rgba(11,43,48,0.75)", color: "#fff", fontWeight: 700, fontSize: 17, padding: "7px 15px", borderRadius: 999, display: "flex" }}>
              {dict.share.before}
            </div>
          </div>
          <div style={{ width: 400, height: 260, borderRadius: 22, background: "linear-gradient(180deg,#cdeed7,#a7e6c0)", position: "relative", display: "flex", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 16, top: 16, background: "#fff", color: "#1B8B4A", fontWeight: 700, fontSize: 17, padding: "7px 15px", borderRadius: 999, display: "flex" }}>
              {dict.share.after}
            </div>
          </div>
        </div>

        {/* headline + credit */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 34 }}>
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 56, letterSpacing: "-0.02em" }}>{dict.share.resolvedAfter}</span>
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 74, color: "#2ECC71", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{resolvedDays}</span>
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 56, letterSpacing: "-0.02em" }}>{dict.severity.days}.</span>
        </div>
        <div style={{ display: "flex", fontWeight: 600, fontSize: 24, opacity: 0.85, marginTop: 8 }}>
          {dict.share.credit} {authority}
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: "auto" }}>
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 24, color: "#00B4C8" }}>{url}</span>
          <span style={{ fontWeight: 600, fontSize: 20, opacity: 0.7 }}>{dict.share.footerClaim}</span>
        </div>
      </div>
    );
  }

  // variant === "new"
  return (
    <div style={{ width: 1200, height: 630, display: "flex", background: "#fff", fontFamily: "Mulish, sans-serif" }}>
      <div style={{ width: 560, height: "100%", flex: "none", background: SCENE, position: "relative" }}>
        <div style={{ position: "absolute", left: 300, bottom: 200, width: 120, height: 88, borderRadius: 6, backgroundImage: PIX }} />
        <div style={{ position: "absolute", left: 28, top: 28, background: "rgba(11,43,48,0.82)", color: "#fff", fontWeight: 700, fontSize: 18, padding: "9px 16px", borderRadius: 999 }}>{category}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(transparent,rgba(11,43,48,0.55))", padding: 28, color: "#fff", fontWeight: 600, fontSize: 18 }}>{dict.share.anon}</div>
      </div>
      <div style={{ flex: 1, padding: "50px 54px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark size={40} />
          <span style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 34, color: "#0B2B30", letterSpacing: "-0.02em" }}>Drosia</span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ background: "#E0F3F5", color: "#00A6BC", fontFamily: "Nunito", fontWeight: 800, fontSize: 22, padding: "10px 20px", borderRadius: 999 }}>{dict.share.newBadge}</div>
          <div style={{ fontFamily: "Nunito", fontWeight: 900, fontSize: 60, lineHeight: 1.05, color: "#0B2B30", letterSpacing: "-0.02em", margin: "22px 0 10px" }}>{dict.share.newHead}</div>
          <div style={{ fontWeight: 600, fontSize: 24, color: "#5B7378" }}>{authority} · {place}</div>
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
