import { notFound } from "next/navigation";
import { TrackingScreen } from "@/components/screens/TrackingScreen";
import { getPublicReport } from "@/lib/reports";

/**
 * Report detail / Tracking — /r/<token>. The most-shared entry point.
 * Reads the published report through v_public_reports (anonymized, no PII).
 * An unknown/unpublished token yields the friendly 404 (see not-found.tsx).
 * Dev (no Supabase) falls back to the design mock: /r/demo-open · demo-resolved.
 */
export default async function TrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicReport(token);
  if (!report) notFound();
  return <TrackingScreen report={report} />;
}
