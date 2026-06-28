import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { REPORT_PUBLIC_BUCKET } from "@/lib/storage";

/**
 * DSA notice-and-takedown cleanup. When a report is unpublished (rejected or a
 * content flag is actioned), the anonymized photo lives in a PUBLIC storage
 * bucket and stays reachable by its direct URL even though the report no longer
 * appears in any view. This removes those public objects and nulls public_path
 * so the content cannot be re-surfaced. Originals stay in the private bucket for
 * the audit trail. Best-effort + idempotent — safe to call more than once.
 */
export async function purgePublicPhotos(reportId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: photos } = await admin
    .from("report_photos")
    .select("public_path")
    .eq("report_id", reportId)
    .returns<{ public_path: string | null }[]>();

  const paths = (photos ?? []).map((p) => p.public_path).filter((p): p is string => !!p);
  if (paths.length) {
    await admin.storage.from(REPORT_PUBLIC_BUCKET).remove(paths).catch(() => {});
    await admin
      .from("report_photos")
      .update({ public_path: null } as never)
      .eq("report_id", reportId);
  }
}
