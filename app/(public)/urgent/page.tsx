import { ListScreen } from "@/components/screens/ListScreen";
import { listPublicReports } from "@/lib/reports";

// Render per request (CSP nonce); the ranking reads the short-TTL public-read
// cache in lib/reports.ts, so new reports/votes show within ~30s.
export const dynamic = "force-dynamic";

/** Most-urgent list — /urgent. Ranked by votes & confirmations (real data). */
export default async function UrgentPage() {
  const reports = await listPublicReports();
  return <ListScreen reports={reports} />;
}
