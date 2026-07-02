import { notFound } from "next/navigation";
import { TrackingScreen } from "@/components/screens/TrackingScreen";
import { PendingScreen } from "@/components/screens/PendingScreen";
import { getPublicReport, getPendingReportStatus } from "@/lib/reports";

/**
 * Report detail / Tracking — /r/<token>. The most-shared entry point.
 * Reads the published report through v_public_reports (anonymized, no PII).
 * A report that exists but isn't public yet (submitted / blur pending) gets a
 * minimal status-only pending view — the success screen links here right after
 * submit, and a 404 at that moment would look like the report was lost.
 * Unknown/rejected/hidden tokens yield the friendly 404 (see not-found.tsx).
 * Dev (no Supabase) falls back to the design mock: /r/demo-open · demo-resolved.
 */
export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicReport(token);
  if (report) return <TrackingScreen report={report} />;

  const pending = await getPendingReportStatus(token);
  if (!pending) notFound();
  return <PendingScreen report={pending} />;
}
