import "server-only";
import sharp from "sharp";

export const MAX_INPUT_PIXELS = 25_000_000;
export const MAX_INPUT_EDGE_PX = 12_000;
const SAFE_FORMATS = new Set(["jpeg", "png", "webp"]);

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Decode untrusted image bytes with a pixel cap, reject disguised/animated
 * formats, strip metadata, and emit a bounded JPEG for private storage.
 */
export async function normalizeUploadedImage(input: Uint8Array): Promise<Buffer> {
  try {
    const decoder = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      animated: false,
    });
    const metadata = await decoder.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!metadata.format || !SAFE_FORMATS.has(metadata.format)) {
      throw new ImageValidationError("Unsupported image encoding.");
    }
    if (!width || !height || width > MAX_INPUT_EDGE_PX || height > MAX_INPUT_EDGE_PX) {
      throw new ImageValidationError("Image dimensions are invalid or too large.");
    }
    if (width * height > MAX_INPUT_PIXELS) {
      throw new ImageValidationError("Image has too many pixels.");
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ImageValidationError("Animated or multi-page images are not supported.");
    }

    return await decoder
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("Image could not be decoded safely.");
  }
}
