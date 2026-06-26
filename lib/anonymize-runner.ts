import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anonymizeImage } from "@/lib/providers/anonymize";

/**
 * Run anonymization for every not-yet-done photo of a report and persist the
 * result: set report_photos.public_path + blur_status. A report only becomes
 * publicly visible once all its photos are 'done' (enforced by v_public_reports)
 * AND it has been approved (status in_review/notified/resolved).
 *
 * Best-effort and idempotent: safe to re-run from moderation if a photo failed.
 */
export async function anonymizeReportPhotos(reportId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: photos, error } = await admin
    .from("report_photos")
    .select("id, original_path, blur_status")
    .eq("report_id", reportId);

  if (error || !photos) return;

  for (const photo of photos as { id: string; original_path: string; blur_status: string }[]) {
    if (photo.blur_status === "done") continue;
    const result = await anonymizeImage(photo.original_path);
    await admin
      .from("report_photos")
      .update({
        public_path: result.status === "done" ? result.publicPath : null,
        blur_status: result.status,
      } as never)
      .eq("id", photo.id);
  }
}
