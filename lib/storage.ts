/**
 * Storage URL helpers. The ANONYMIZED variant lives in a PUBLIC bucket and is the
 * only image ever shown on shared surfaces (public app + admin previews). Originals
 * live in a private bucket and are reachable only via service-role signed URLs.
 */
export const REPORT_PUBLIC_BUCKET = "report-public";

/** Public URL for an anonymized photo path in the public bucket. */
export function anonymizedPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${REPORT_PUBLIC_BUCKET}/${path}`;
}
