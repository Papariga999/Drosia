import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { anonymizeImage } from "@/lib/providers/anonymize";

/**
 * Run anonymization for every not-yet-done photo of a report and persist the
 * result: set report_photos.public_path + blur_status. Pending metadata may be
 * public immediately, but a photo becomes visible only once every photo on the
 * report is 'done'. Published reports retain the same fail-closed gate.
 *
 * Best-effort and idempotent: safe to re-run from moderation if a photo failed.
 */
export async function anonymizeReportPhotos(reportId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: photos, error } = await admin
    .from("report_photos")
    .select("id, original_path, blur_status")
    .eq("report_id", reportId);

  if (error) throw new Error(`Could not load report photos for anonymization: ${error.message}`);
  if (!photos) throw new Error("Could not load report photos for anonymization.");

  for (const photo of photos as { id: string; original_path: string; blur_status: string }[]) {
    if (photo.blur_status === "done") continue;
    const result = await anonymizeImage(photo.original_path);
    const { error: updateError } = await admin
      .from("report_photos")
      .update({
        public_path: result.status === "done" ? result.publicPath : null,
        blur_status: result.status,
      } as never)
      .eq("id", photo.id);
    if (updateError) {
      throw new Error(`Could not persist anonymization result: ${updateError.message}`);
    }
  }
}
