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

/** Download an original from the PRIVATE bucket (service-role only). */
async function downloadOriginal(originalPath: string): Promise<Buffer | null> {
  const { data, error } = await getSupabaseAdmin().storage
    .from(ORIGINALS_BUCKET)
    .download(originalPath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Upload an anonymized buffer to the PUBLIC bucket; returns its path or null. */
async function uploadPublic(buffer: Buffer): Promise<string | null> {
  const publicPath = `public/${randomUUID()}.jpg`;
  const up = await getSupabaseAdmin().storage.from(PUBLIC_BUCKET).upload(publicPath, buffer, {
    contentType: "image/jpeg",
    upsert: false,
  });
  return up.error ? null : publicPath;
}

class DevBlurAnonymizer implements ImageAnonymizer {
  async anonymize(originalPath: string): Promise<AnonymizeResult> {
    const input = await downloadOriginal(originalPath);
    if (!input) return { publicPath: "", status: "failed" };

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

    const publicPath = await uploadPublic(pixelated);
    return publicPath ? { publicPath, status: "done" } : { publicPath: "", status: "failed" };
  }
}

/**
 * Production seam: posts the original to a SELECTIVE face/plate anonymization
 * service (ANONYMIZER_URL, optional Bearer ANONYMIZER_API_KEY) that returns an
 * image with only faces + license plates blurred — keeping the litter sharp.
 * Configure with ANONYMIZER_PROVIDER=http. If the service errors or returns a
 * non-image, we FAIL CLOSED (status 'failed') so an un-anonymized frame can
 * never reach a public surface — the gate stays on blur_status='done'.
 */
class HttpAnonymizer implements ImageAnonymizer {
  async anonymize(originalPath: string): Promise<AnonymizeResult> {
    const endpoint = process.env.ANONYMIZER_URL;
    if (!endpoint) return { publicPath: "", status: "failed" };

    const input = await downloadOriginal(originalPath);
    if (!input) return { publicPath: "", status: "failed" };

    try {
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(input)], { type: "image/jpeg" }), "original.jpg");
      const headers: Record<string, string> = {};
      if (process.env.ANONYMIZER_API_KEY) {
        headers.authorization = `Bearer ${process.env.ANONYMIZER_API_KEY}`;
      }
      const res = await fetch(endpoint, { method: "POST", headers, body: form });
      if (!res.ok) return { publicPath: "", status: "failed" };
      // Re-encode through sharp: strips metadata and guarantees a valid JPEG.
      const out = await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 82 }).toBuffer();

      const publicPath = await uploadPublic(out);
      return publicPath ? { publicPath, status: "done" } : { publicPath: "", status: "failed" };
    } catch {
      return { publicPath: "", status: "failed" }; // fail closed — never expose the original
    }
  }
}

let _anonymizer: ImageAnonymizer | null = null;
export function getAnonymizer(): ImageAnonymizer {
  if (!_anonymizer) {
    _anonymizer =
      process.env.ANONYMIZER_PROVIDER === "http" ? new HttpAnonymizer() : new DevBlurAnonymizer();
  }
  return _anonymizer;
}

export function anonymizeImage(originalPath: string): Promise<AnonymizeResult> {
  return getAnonymizer().anonymize(originalPath);
}
