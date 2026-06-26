import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Image anonymization provider — MANDATORY before any public surface.
 * Public/Share/OG use ONLY the produced public variant; originals stay in the
 * private 'report-originals' bucket (service-role only).
 *
 * DEV provider (default): downloads the original, applies a strong full-image
 * blur + pixelation, strips metadata, and writes the result to 'report-public'.
 * This GUARANTEES no recognizable faces or plates (the whole frame is destroyed
 * in detail) — privacy-safe, but low-utility. PRODUCTION must swap in real
 * SELECTIVE face/plate detection behind this same interface so the rest of the
 * scene stays sharp. The seam is intentional: only getAnonymizer() changes.
 */
export interface AnonymizeResult {
  publicPath: string;
  status: "done" | "failed";
}

export interface ImageAnonymizer {
  anonymize(originalPath: string): Promise<AnonymizeResult>;
}

const ORIGINALS_BUCKET = "report-originals";
const PUBLIC_BUCKET = "report-public";

class DevBlurAnonymizer implements ImageAnonymizer {
  async anonymize(originalPath: string): Promise<AnonymizeResult> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from(ORIGINALS_BUCKET).download(originalPath);
    if (error || !data) return { publicPath: "", status: "failed" };

    const input = Buffer.from(await data.arrayBuffer());
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 1200;

    // Pixelate (downscale then upscale) + blur → no recognizable detail.
    const small = Math.max(16, Math.round(w / 24));
    const pixelated = await sharp(input)
      .resize({ width: small })
      .blur(2)
      .resize({ width: Math.min(w, 1600) })
      .jpeg({ quality: 80 })
      .toBuffer();

    const publicPath = `public/${randomUUID()}.jpg`;
    const up = await admin.storage.from(PUBLIC_BUCKET).upload(publicPath, pixelated, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (up.error) return { publicPath: "", status: "failed" };

    return { publicPath, status: "done" };
  }
}

let _anonymizer: ImageAnonymizer | null = null;
export function getAnonymizer(): ImageAnonymizer {
  if (!_anonymizer) _anonymizer = new DevBlurAnonymizer();
  return _anonymizer;
}

export function anonymizeImage(originalPath: string): Promise<AnonymizeResult> {
  return getAnonymizer().anonymize(originalPath);
}
