import { ListScreen } from "@/components/screens/ListScreen";
import { listPublicReports } from "@/lib/reports";

/** Most-urgent list — /urgent. Ranked by votes & confirmations (real data). */
export default async function UrgentPage() {
  const reports = await listPublicReports();
  return <ListScreen reports={reports} />;
}
