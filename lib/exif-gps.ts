import { gps } from "exifr";

/** GPS coordinates extracted from an original report photo. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Read embedded GPS metadata before the image is compressed (compression strips
 * EXIF). exifr handles the formats phone galleries commonly return, including
 * JPEG and HEIC/HEIF, and does not assume the EXIF block is the first APP1 block.
 */
export async function readExifGps(file: File): Promise<LatLng | null> {
  try {
    // Supplying bytes works consistently in browsers, tests and WebViews whose
    // File/Blob constructors do not share the same JavaScript realm.
    const result = await gps(new Uint8Array(await file.arrayBuffer()));
    const lat = result?.latitude;
    const lng = result?.longitude;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return { lat, lng };
  } catch {
    // Photos without readable GPS metadata fall back to device GPS/manual pin.
    return null;
  }
}

/** Use the first selected photo that actually contains valid GPS metadata. */
export async function readFirstExifGps(files: readonly File[]): Promise<LatLng | null> {
  for (const file of files) {
    const coordinates = await readExifGps(file);
    if (coordinates) return coordinates;
  }
  return null;
}
