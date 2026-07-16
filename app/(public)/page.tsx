import { LandingScreen } from "@/components/screens/LandingScreen";
import { listPublicReports } from "@/lib/reports";
import { getLandingStats } from "@/lib/stats";

// Render per request (CSP nonce); data comes from the short-TTL public-read
// cache in lib/reports.ts, so new reports appear within ~30s without letting a
// request flood fan out into per-view DB queries.
export const dynamic = "force-dynamic";

/** Landing / start page — /. Mission + live map + accountability board (real data). */
export default async function HomePage() {
  const [stats, reports] = await Promise.all([getLandingStats(), listPublicReports(80)]);
  return <LandingScreen stats={stats} reports={reports} />;
}
