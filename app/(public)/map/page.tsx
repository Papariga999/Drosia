import { MapScreen } from "@/components/screens/MapScreen";
import { listPublicReports } from "@/lib/reports";

/** Map — /map. Spatial overview; severity pins, clusters, heatmap. */
export default async function MapPage() {
  const reports = await listPublicReports();
  return <MapScreen reports={reports} />;
}
