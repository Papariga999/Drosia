import { LandingScreen } from "@/components/screens/LandingScreen";
import { getLandingStats } from "@/lib/stats";

// Render per request so live aggregates/board reflect new reports immediately.
export const dynamic = "force-dynamic";

/** Landing / start page — /. Mission + live map + accountability board (real data). */
export default async function HomePage() {
  const stats = await getLandingStats();
  return <LandingScreen stats={stats} />;
}
