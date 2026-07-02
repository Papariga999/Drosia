import { MapScreen } from "@/components/screens/MapScreen";
import { listPublicReports, listPendingReportPins } from "@/lib/reports";

// Render per request so newly published reports show without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Map — /map. Spatial overview; severity pins, clusters, heatmap.
 * Includes PENDING pins (submitted / awaiting anonymization) rendered as
 * neutral gray markers — a reporter sees their report on the map immediately,
 * clearly marked as "in review" until the Drosia team approves it.
 */
export default async function MapPage() {
  const [published, pending] = await Promise.all([listPublicReports(), listPendingReportPins()]);
  return <MapScreen reports={[...published, ...pending]} />;
}
