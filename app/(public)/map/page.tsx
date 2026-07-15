import { MapScreen } from "@/components/screens/MapScreen";
import { listPublicReports } from "@/lib/reports";

// Render per request so newly published reports show without a rebuild.
export const dynamic = "force-dynamic";

/**
 * Map — /map. Spatial overview of approved, fully anonymized reports.
 * Submitted reports stay private until moderation is complete.
 */
export default async function MapPage() {
  return <MapScreen reports={await listPublicReports()} />;
}
