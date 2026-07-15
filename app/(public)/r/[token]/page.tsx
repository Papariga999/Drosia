import { notFound } from "next/navigation";
import { TrackingScreen } from "@/components/screens/TrackingScreen";
import { getPublicReport, listNearbyReports } from "@/lib/reports";

/**
 * Report detail / Tracking — /r/<token>. The most-shared entry point.
 * Reads the published report through v_public_reports (anonymized, no PII).
 * Submitted, rejected, hidden, and unknown tokens all yield the friendly 404;
 * pre-moderation existence and location are never exposed publicly.
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
