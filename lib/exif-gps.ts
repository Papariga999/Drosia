/**
 * Minimal, dependency-free EXIF GPS extractor for JPEG files.
 *
 * Reads the APP1/TIFF block, finds the GPS IFD and returns decimal lat/lng.
 * It only needs GPS tags, so it parses just enough of the structure. If the
 * photo has no GPS (or isn't a JPEG), it returns null and the caller falls back
 * to live geolocation — this is best-effort progressive enhancement.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export async function readExifGps(file: File): Promise<LatLng | null> {
  try {
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1) {
        // APP1 — check for "Exif\0\0"
        if (view.getUint32(offset + 4) === 0x45786966) {
          return parseTiffGps(view, offset + 10);
        }
        return null;
      }
      if ((marker & 0xff00) !== 0xff00) return null;
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiffGps(view: DataView, tiffStart: number): LatLng | null {
  const little = view.getUint16(tiffStart) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  const ifd0 = tiffStart + u32(tiffStart + 4);
  const entries = u16(ifd0);

  let gpsIfdOffset = 0;
  for (let i = 0; i < entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (u16(entry) === 0x8825) {
      gpsIfdOffset = tiffStart + u32(entry + 8);
      break;
    }
  }
  if (!gpsIfdOffset) return null;

  const gpsEntries = u16(gpsIfdOffset);
  let latRef = "N";
  let lngRef = "E";
  let lat: number | null = null;
  let lng: number | null = null;

  const readRational3 = (valueOffset: number): number => {
    // Three RATIONALs (deg, min, sec); each is 8 bytes (num/den).
    const base = tiffStart + valueOffset;
    const deg = u32(base) / u32(base + 4);
    const min = u32(base + 8) / u32(base + 12);
    const sec = u32(base + 16) / u32(base + 20);
    return deg + min / 60 + sec / 3600;
  };

  for (let i = 0; i < gpsEntries; i++) {
    const entry = gpsIfdOffset + 2 + i * 12;
    const tag = u16(entry);
    const valueOffset = u32(entry + 8);
    if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(entry + 8));
    else if (tag === 0x0002) lat = readRational3(valueOffset);
    else if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(entry + 8));
    else if (tag === 0x0004) lng = readRational3(valueOffset);
  }

  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;
  return { lat, lng };
}
