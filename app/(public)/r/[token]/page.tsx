import { notFound } from "next/navigation";
import { TrackingScreen } from "@/components/screens/TrackingScreen";
import { getPublicReport, listNearbyReports } from "@/lib/reports";

/**
 * Report detail / Tracking — /r/<token>. The most-shared entry point.
 * Reads the published report through v_public_reports (anonymized, no PII).
 * Submitted reports are exposed as privacy-safe pending records: no description,
 * and the photo appears only after anonymization. Rejected/hidden tokens stay private.
 * Dev (no Supabase) falls back to the design mock: /r/demo-open · demo-resolved.
 */
export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicReport(token);
  if (report) {
    const nearby = await listNearbyReports(report);
    return <TrackingScreen report={report} nearby={nearby} />;
  }

  notFound();
}
