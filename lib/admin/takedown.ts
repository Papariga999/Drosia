import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { REPORT_PUBLIC_BUCKET } from "@/lib/storage";

/**
 * DSA notice-and-takedown cleanup. When a report is unpublished (rejected or a
 * content flag is actioned), the anonymized photo lives in a PUBLIC storage
 * bucket and stays reachable by its direct URL even though the report no longer
 * appears in any view. This removes those public objects and nulls public_path
 * so the content cannot be re-surfaced. Originals stay in the private bucket for
 * the audit trail. Idempotent and fail-loud so an open flag remains retryable
 * when storage deletion fails.
 */
export async function purgePublicPhotos(reportId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: photos, error: photoError } = await admin
    .from("report_photos")
    .select("public_path")
    .eq("report_id", reportId)
    .returns<{ public_path: string | null }[]>();
  if (photoError) throw new Error(`Public photo lookup failed: ${photoError.message}`);

  const paths = (photos ?? []).map((p) => p.public_path).filter((p): p is string => !!p);
  if (paths.length) {
    const { error: storageError } = await admin.storage.from(REPORT_PUBLIC_BUCKET).remove(paths);
    if (storageError) throw new Error(`Public photo takedown failed: ${storageError.message}`);

    const { error: updateError } = await admin
      .from("report_photos")
      .update({ public_path: null } as never)
      .eq("report_id", reportId);
    if (updateError) throw new Error(`Public photo metadata cleanup failed: ${updateError.message}`);
  }
}
