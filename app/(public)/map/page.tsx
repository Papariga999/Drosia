import { MapScreen } from "@/components/screens/MapScreen";
import { listPublicReports } from "@/lib/reports";

// Render per request so newly published reports show without a rebuild.
export const dynamic = "force-dynamic";

/** Map — /map. Spatial overview; severity pins, clusters, heatmap. */
export default async function MapPage() {
  const reports = await listPublicReports();
  return <MapScreen reports={reports} />;
}
