import { z } from "zod";
import { REPORT_CATEGORIES } from "./categories";
import { LOCALES } from "./i18n";

/**
 * Server-side validation for the submit route. Kept as a pure module (no I/O) so
 * the rules are unit-testable in isolation from the HTTP handler.
 *
 * Limits mirror the non-negotiables: category enum, description <= 500 chars,
 * point inside plausible lat/lng, mandatory upload consent, 1..3 photos.
 */
export const MAX_DESCRIPTION = 500;
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB per original
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const reportFieldsSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  category: z.enum(REPORT_CATEGORIES),
  description: z
    .string()
    .max(MAX_DESCRIPTION, `Description must be at most ${MAX_DESCRIPTION} characters`)
    .optional()
    .transform((v) => v?.trim() ?? ""),
  locale: z.enum(LOCALES).default("en"),
  // Mandatory upload consent (no recognizable persons / rights to the photo).
  // NB: parse the literal value — z.coerce.boolean() would treat the string
  // "false" as true (non-empty string is truthy), silently bypassing consent.
  consent: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true" || v === "on" || v === "1")
    .refine((v) => v === true, "Upload consent is required"),
  // Anonymous device token (NOT PII). Optional — only for "my reports".
  authorToken: z.string().trim().max(128).optional().default(""),
  // Honeypot: real users never fill this. Must be empty.
  website: z.string().max(0).optional().default(""),
});

export type ReportFields = z.infer<typeof reportFieldsSchema>;

export interface PhotoLike {
  size: number;
  type: string;
}

export function validatePhotos(photos: PhotoLike[]): { ok: true } | { ok: false; error: string } {
  if (photos.length < 1) return { ok: false, error: "At least one photo is required" };
  if (photos.length > MAX_PHOTOS) return { ok: false, error: `At most ${MAX_PHOTOS} photos allowed` };
  for (const p of photos) {
    if (p.size > MAX_PHOTO_BYTES) return { ok: false, error: "Photo exceeds size limit (12 MB)" };
    if (p.type && !ACCEPTED_IMAGE_TYPES.includes(p.type)) {
      return { ok: false, error: `Unsupported image type: ${p.type}` };
    }
  }
  return { ok: true };
}
