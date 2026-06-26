import "server-only";
import type { Locale } from "./i18n";
import { reportAgeDays } from "./severity";
import { listPublicReports, getScorecard } from "./reports";

/**
 * Landing-page aggregates — all COMPUTED from real data (never hardcoded), with
 * test data already excluded by the views. The leaderboard comes straight from
 * v_authority_scorecard (fairness enforced: n>=10, notified-only) and is EMPTY
 * until an authority qualifies — the landing then shows the mission/CTA instead
 * of a fake board (the "Berlin in the board" anti-pattern guard).
 */
export interface LandingStats {
  openCount: number;
  ignoredDays: number;
  board: { authority_id: string; name: Record<Locale, string>; rate: number }[];
  gallery: { token: string; days: number; photo_url?: string }[];
}

export async function getLandingStats(): Promise<LandingStats> {
  const [reports, scorecard] = await Promise.all([listPublicReports(), getScorecard()]);

  const open = reports.filter((r) => r.status !== "resolved");
  const ignoredDays = open.reduce((sum, r) => sum + reportAgeDays(r), 0);

  const gallery = reports
    .filter((r) => r.status === "resolved")
    .slice(0, 4)
    .map((r) => ({ token: r.public_token, days: reportAgeDays(r), photo_url: r.photo_url }));

  const board = scorecard
    .slice(0, 5)
    .map((s) => ({ authority_id: s.authority_id, name: s.name, rate: Math.round(s.resolution_rate_pct) }));

  return { openCount: open.length, ignoredDays, board, gallery };
}
