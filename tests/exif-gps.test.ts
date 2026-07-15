import { describe, expect, it } from "vitest";
import { readExifGps, readFirstExifGps } from "@/lib/exif-gps";

function app1(payload: Uint8Array): Uint8Array {
  const segment = new Uint8Array(payload.length + 4);
  const view = new DataView(segment.buffer);
  view.setUint16(0, 0xffe1);
  view.setUint16(2, payload.length + 2);
  segment.set(payload, 4);
  return segment;
}

function jpegWithGps(): File {
  const tiff = new Uint8Array(128);
  const view = new DataView(tiff.buffer);
  const u16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const u32 = (offset: number, value: number) => view.setUint32(offset, value, true);

  // Little-endian TIFF header and IFD0 containing the GPS IFD pointer.
  tiff.set([0x49, 0x49], 0);
  u16(2, 42);
  u32(4, 8);
  u16(8, 1);
  u16(10, 0x8825);
  u16(12, 4);
  u32(14, 1);
  u32(18, 26);
  u32(22, 0);

  // GPS IFD: latitude/ref and longitude/ref.
  u16(26, 4);
  const gpsEntry = (index: number, tag: number, type: number, count: number, value: number) => {
    const offset = 28 + index * 12;
    u16(offset, tag);
    u16(offset + 2, type);
    u32(offset + 4, count);
    u32(offset + 8, value);
  };
  gpsEntry(0, 0x0001, 2, 2, 0x4e); // N\0 stored inline
  gpsEntry(1, 0x0002, 5, 3, 80);
  gpsEntry(2, 0x0003, 2, 2, 0x45); // E\0 stored inline
  gpsEntry(3, 0x0004, 5, 3, 104);
  u32(76, 0);

  const rational = (offset: number, numerator: number, denominator = 1) => {
    u32(offset, numerator);
    u32(offset + 4, denominator);
  };
  rational(80, 36);
  rational(88, 26);
  rational(96, 0);
  rational(104, 28);
  rational(112, 13);
  rational(120, 0);

  const exifPayload = new Uint8Array(6 + tiff.length);
  exifPayload.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  exifPayload.set(tiff, 6);

  // A valid non-EXIF APP1 segment precedes EXIF. The former implementation
  // stopped here and never reached the GPS metadata.
  const xmp = app1(new TextEncoder().encode("http://ns.adobe.com/xap/1.0/\0<xmp/>"));
  const exif = app1(exifPayload);
  return new File(
    [
      new Uint8Array([0xff, 0xd8]),
      xmp.buffer as ArrayBuffer,
      exif.buffer as ArrayBuffer,
      new Uint8Array([0xff, 0xd9]),
    ],
    "rhodes.jpg",
    { type: "image/jpeg" },
  );
}

describe("photo GPS extraction", () => {
  it("finds EXIF GPS even when another APP1 block appears first", async () => {
    await expect(readExifGps(jpegWithGps())).resolves.toEqual({
      lat: 36 + 26 / 60,
      lng: 28 + 13 / 60,
    });
  });

  it("uses the first selected photo that contains GPS", async () => {
    const noGps = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "plain.jpg", {
      type: "image/jpeg",
    });

    await expect(readFirstExifGps([noGps, jpegWithGps()])).resolves.toEqual({
      lat: 36 + 26 / 60,
      lng: 28 + 13 / 60,
    });
  });

  it("returns null when metadata is absent", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "plain.jpg", {
      type: "image/jpeg",
    });
    await expect(readExifGps(file)).resolves.toBeNull();
  });
});
