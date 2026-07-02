/**
 * Client-side photo compression before upload.
 *
 * Vercel rejects request bodies over ~4.5 MB, so raw phone photos (3–8 MB each,
 * up to 3 per report) must be downscaled in the browser — the server-side sharp
 * pass can never rescue a request the platform already refused with 413.
 * Re-encoding to JPEG here also converts iOS HEIC (decodable by WebKit, the only
 * engine that produces it) into a format sharp can always process.
 *
 * NB: canvas re-encoding strips EXIF, including GPS — callers must read EXIF GPS
 * from the ORIGINAL file first (ReportFlow does; see readExifGps).
 *
 * Best-effort: on any failure (undecodable format, canvas limits) the original
 * file is returned unchanged so small uploads still work.
 */
export const MAX_UPLOAD_EDGE_PX = 1600;
export const UPLOAD_JPEG_QUALITY = 0.82;

/** Formats the server (sharp prebuilt) can decode — safe to send uncompressed. */
const SERVER_DECODABLE = ["image/jpeg", "image/png", "image/webp"];

export async function compressImage(file: File): Promise<File> {
  try {
    // from-image: honor EXIF orientation so the re-encoded JPEG isn't rotated.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_UPLOAD_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
    );
    if (!blob) return file;

    // Keep the original only if it's both smaller AND a format the server can
    // decode (a smaller HEIC would still fail server-side).
    if (blob.size >= file.size && SERVER_DECODABLE.includes(file.type)) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
