import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { REPORT_PUBLIC_BUCKET, REPORT_ORIGINALS_BUCKET } from "@/lib/storage";

/**
 * Hard-delete a report and everything attached to it. Child rows
 * (report_photos, delivery_logs, authority_responses, content_flags,
 * report_votes) drop via `on delete cascade`, but storage objects are NOT
 * cascaded — so we remove both the anonymized (public bucket) and original
 * (private bucket) files first, then delete the row. Storage removals are
 * best-effort: a missing object must never block the DB delete (idempotent).
 * Use for test reports or content that must be erased entirely; for reversible
 * takedown prefer reject (status) or admin_hidden (unpublish).
 */
export async function deleteReportCompletely(
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string; notFound?: boolean }> {
  const admin = getSupabaseAdmin();

  const { data: report, error: reportError } = await admin
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .maybeSingle<{ id: string }>();
  if (reportError) return { ok: false, error: reportError.message };
  if (!report) return { ok: false, error: "Report not found.", notFound: true };

  const { data: photos, error: photoError } = await admin
    .from("report_photos")
    .select("original_path, public_path")
    .eq("report_id", reportId)
    .returns<{ original_path: string | null; public_path: string | null }[]>();
  if (photoError) return { ok: false, error: photoError.message };

  const originals = (photos ?? []).map((p) => p.original_path).filter((p): p is string => !!p);
  const publics = (photos ?? []).map((p) => p.public_path).filter((p): p is string => !!p);

  if (originals.length) {
    const { error } = await admin.storage.from(REPORT_ORIGINALS_BUCKET).remove(originals);
    if (error) return { ok: false, error: `Original photo deletion failed: ${error.message}` };
  }
  if (publics.length) {
    const { error } = await admin.storage.from(REPORT_PUBLIC_BUCKET).remove(publics);
    if (error) return { ok: false, error: `Public photo deletion failed: ${error.message}` };
  }

  const { error } = await admin.from("reports").delete().eq("id", reportId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
