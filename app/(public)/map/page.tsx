import { MapScreen } from "@/components/screens/MapScreen";
import { listPublicReports } from "@/lib/reports";

// Render per request (CSP nonce); pins come from the short-TTL public-read
// cache in lib/reports.ts — newly published reports show within ~30s.
export const dynamic = "force-dynamic";

/**
 * Map — /map. Spatial overview of approved, fully anonymized reports.
 * Submitted reports stay private until moderation is complete.
 */
export default async function MapPage() {
  return <MapScreen reports={await listPublicReports()} />;
}
