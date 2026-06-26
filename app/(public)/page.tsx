import { LandingScreen } from "@/components/screens/LandingScreen";
import { getLandingStats } from "@/lib/stats";

/** Landing / start page — /. Mission + live map + accountability board (real data). */
export default async function HomePage() {
  const stats = await getLandingStats();
  return <LandingScreen stats={stats} />;
}
