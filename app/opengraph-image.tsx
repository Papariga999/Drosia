import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site-url";

export const runtime = "nodejs";
export const alt = "Drosia — See it. Report it. Watch what happens.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default share card for all pages (design §3d) — light aqua gradient, ripple
 * circles, brand claim. Report status pages override it with their own
 * opengraph-image (report photo / 1g resolved card).
 */
export default async function DefaultOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "72px 80px",
          background: "radial-gradient(130% 100% at 20% 0%, #F2FBFC 0%, #DCF2F4 100%)",
          color: "#0B2B30",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <svg
          width="520"
          height="520"
          viewBox="0 0 300 300"
          style={{ position: "absolute", right: -140, bottom: -140, opacity: 0.35 }}
        >
          <circle cx="150" cy="150" r="70" fill="none" stroke="#00B4C8" strokeWidth="2" />
          <circle cx="150" cy="150" r="105" fill="none" stroke="#00B4C8" strokeWidth="2" opacity="0.6" />
          <circle cx="150" cy="150" r="140" fill="none" stroke="#00B4C8" strokeWidth="2" opacity="0.35" />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
            <path
              d="M24 3C13.5 3 5 11.3 5 21.6 5 35 24 61 24 61s19-26 19-39.4C43 11.3 34.5 3 24 3Z"
              fill="#00B4C8"
            />
            <circle cx="24" cy="21" r="8.4" fill="#F2FBFC" />
          </svg>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 900 }}>
            Drosia<span style={{ color: "#00B4C8" }}>.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              lineHeight: 1.1,
              fontWeight: 900,
              letterSpacing: "-1.5px",
              maxWidth: "840px",
            }}
          >
            <div style={{ display: "flex" }}>See it. Report it.</div>
            <div style={{ display: "flex", color: "#00A6BC" }}>Watch what happens.</div>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: "#5B7378" }}>
            Report litter in under 60 seconds — no account · {SITE_HOST}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
