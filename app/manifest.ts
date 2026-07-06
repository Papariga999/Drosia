import type { MetadataRoute } from "next";

/**
 * PWA manifest (design §3a "App icon & favicon"). Assets live in
 * public/brand/ — exported from the design file, not redrawn. The maskable
 * variant keeps the pin inside the 80% safe zone; Android/iOS do the masking.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Drosia",
    short_name: "Drosia",
    description:
      "Report litter & environmental issues to the responsible authority. Keep it fresh & clean.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7FBFC",
    theme_color: "#00B4C8",
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
