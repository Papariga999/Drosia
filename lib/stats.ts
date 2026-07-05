import "server-only";
import type { Locale } from "./i18n";
import { RANKING_THRESHOLD } from "./ranking";
import { reportAgeDays } from "./severity";
import { listPublicReports, getScorecard } from "./reports";

/**
 * Landing-page aggregates — all COMPUTED from real data (never hardcoded), with
 * test data already excluded by the views. The leaderboard comes straight from
 * v_authority_scorecard (fairness enforced: n>=10, notified-only) and is EMPTY
 * until an authority qualifies — the landing then shows the ranking-progress
 * module instead of a fake board (the "Berlin in the board" anti-pattern guard).
 *
 * Site-review handover 1a: no zero-counters on the home page. Instead of a
 * global "ignored days" sum that starts at 0, we surface the OLDEST open
 * report's age (the clock promise), and instead of "ranking starts soon" we
 * show how close the leading authority is to the n>=10 ranking threshold.
 */
export interface LandingStats {
  openCount: number;
  /** Age in days of the oldest open report; null when there are no open reports. */
  oldestOpenDays: number | null;
  board: { authority_id: string; name: Record<Locale, string>; rate: number }[];
  /** Ranking progress of the authority closest to qualifying (delivered < threshold). */
  progress: { name: Record<Locale, string>; delivered: number } | null;
  gallery: { token: string; days: number; photo_url?: string }[];
}

export async function getLandingStats(): Promise<LandingStats> {
  const [reports, scorecard] = await Promise.all([listPublicReports(), getScorecard()]);

  const open = reports.filter((r) => r.status !== "resolved");
  const oldestOpenDays = open.length ? Math.max(...open.map((r) => reportAgeDays(r))) : null;

  const gallery = reports
    .filter((r) => r.status === "resolved")
    .slice(0, 4)
    .map((r) => ({ token: r.public_token, days: reportAgeDays(r), photo_url: r.photo_url }));

  const board = scorecard
    .slice(0, 5)
    .map((s) => ({ authority_id: s.authority_id, name: s.name, rate: Math.round(s.resolution_rate_pct) }));

  // Delivered (= forwarded to the authority) per authority, computed from the
  // public view: only notified/resolved reports carry notified_at. The module
  // highlights the authority closest to the ranking threshold.
  let progress: LandingStats["progress"] = null;
  if (!board.length) {
    const delivered = new Map<string, { name: Record<Locale, string>; count: number }>();
    for (const r of reports) {
      if (!r.notified_at) continue;
      const key = JSON.stringify(r.authority_name);
      const entry = delivered.get(key) ?? { name: r.authority_name, count: 0 };
      entry.count += 1;
      delivered.set(key, entry);
    }
    const leader = [...delivered.values()]
      .filter((e) => e.count < RANKING_THRESHOLD)
      .sort((a, b) => b.count - a.count)[0];
    progress = leader
      ? { name: leader.name, delivered: leader.count }
      : { name: { el: "", en: "", de: "" }, delivered: 0 };
  }

  return { openCount: open.length, oldestOpenDays, board, progress, gallery };
}
