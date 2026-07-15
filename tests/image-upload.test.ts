import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageValidationError, normalizeUploadedImage } from "@/lib/image-upload";

describe("untrusted image normalization", () => {
  it("decodes an allowed raster format and emits a bounded metadata-free JPEG", async () => {
    const input = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "#2d8f83" },
    })
      .png()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const output = await normalizeUploadedImage(input);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(24); // EXIF orientation was applied before stripping
    expect(metadata.height).toBe(32);
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects SVG content even when a caller could label it as an image", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(normalizeUploadedImage(svg)).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("rejects undecodable bytes", async () => {
    await expect(normalizeUploadedImage(Buffer.from("not an image"))).rejects.toBeInstanceOf(
      ImageValidationError,
    );
  });
});
