import { ImageResponse } from "next/og";
import { categoryLabel } from "@/lib/categories";
import { getDict, type Locale } from "@/lib/i18n";
import { getPublicReport } from "@/lib/reports";
import { reportAgeDays } from "@/lib/severity";

export const runtime = "nodejs";
export const alt = "Drosia report share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ReportOpenGraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const locale: Locale = "en";
  const dict = getDict(locale);

  // Always anonymized data only; a generic card if the token isn't a public report.
  const report = await getPublicReport(token);
  if (!report) {
    return new ImageResponse(
      (
        <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#00B4C8", color: "#fff", fontFamily: "Arial, sans-serif" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 900 }}>Drosia</div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 32, fontWeight: 800, opacity: 0.9 }}>Keep it fresh &amp; clean.</div>
        </div>
      ),
      size,
    );
  }

  const days = reportAgeDays(report);
  const isResolved = report.status === "resolved";
  const isIgnored = !isResolved && days >= 30;
  const theme = isResolved
    ? { bg: "#2ECC71", fg: "#FFFFFF", panel: "rgba(255,255,255,0.18)", accent: "#FFFFFF" }
    : isIgnored
      ? { bg: "#E74C3C", fg: "#FFFFFF", panel: "rgba(255,255,255,0.16)", accent: "#FFFFFF" }
      : { bg: "#FFFFFF", fg: "#0B2B30", panel: "#E0F3F5", accent: "#00B4C8" };

  const category = categoryLabel(report.category, locale);
  const authority = report.authority_name[locale] || "Drosia";
  const headline = isResolved
    ? dict.share.resolvedHead
    : isIgnored
      ? `${days} ${dict.share.ignoredHead}`
      : dict.share.newHead;
  const eyebrow = isResolved
    ? `${dict.share.resolvedAfter} ${days} ${dict.severity.days}`
    : isIgnored
      ? `${dict.share.ignoredLabel} ${days} ${dict.severity.days}`
      : dict.share.newBadge;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: theme.bg,
          color: theme.fg,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "520px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "34px",
            background: isResolved
              ? "linear-gradient(135deg,#D7F7E1,#A6E9BF)"
              : "linear-gradient(135deg,#D7E8EA,#AFCFD4)",
            color: "#0B2B30",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "9px 16px",
                borderRadius: "999px",
                background: "rgba(11,43,48,0.78)",
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {category}
            </div>
            <div
              style={{
                display: "flex",
                padding: "9px 14px",
                borderRadius: "999px",
                background: "#FFFFFF",
                color: isResolved ? "#1B8B4A" : "#00A6BC",
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              {isResolved ? dict.status.resolved : dict.share.anon}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "360px",
              borderRadius: "26px",
              background:
                "repeating-linear-gradient(0deg,rgba(11,43,48,0.18) 0 18px,rgba(11,43,48,0.08) 18px 36px)",
              border: "4px solid rgba(255,255,255,0.75)",
            }}
          >
            <div style={{ display: "flex", fontSize: 86, fontWeight: 900 }}>
              {isResolved ? "CLEAN" : "BLURRED"}
            </div>
            <div style={{ display: "flex", marginTop: 16, fontSize: 24, fontWeight: 800 }}>
              {isResolved ? dict.share.after : dict.share.anon}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, fontWeight: 800 }}>
            drosia.eu/r/{report.public_token}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            height: "630px",
            display: "flex",
            flexDirection: "column",
            padding: "52px 58px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 58,
                height: 58,
                borderRadius: 18,
                background: theme.panel,
                alignItems: "center",
                justifyContent: "center",
                color: theme.accent,
                fontSize: 36,
                fontWeight: 900,
              }}
            >
              D
            </div>
            <div style={{ display: "flex", marginLeft: 16, fontSize: 42, fontWeight: 900 }}>
              Drosia
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: "12px 22px",
                borderRadius: "999px",
                background: theme.panel,
                color: theme.accent,
                fontSize: 26,
                fontWeight: 900,
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 30,
                fontSize: isIgnored ? 104 : 74,
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-2px",
              }}
            >
              {headline}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 28,
                lineHeight: 1.25,
                fontWeight: 800,
                opacity: 0.86,
              }}
            >
              {authority}
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, opacity: 0.72 }}>
            Keep it fresh & clean.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
