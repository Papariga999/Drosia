/**
 * Severity scale — "the heart" of Drosia. Age is measured since
 * `notified_at ?? created_at`. Breakpoints are fixed (see design handoff):
 *   🟢 fresh  < 7 days
 *   🟡 mild   < 30 days
 *   🟠 warn   < 60 days
 *   🔴 stale  >= 60 days
 * Resolved reports freeze their counter ("Fixed after N days").
 */
export type SeverityLevel = "fresh" | "mild" | "warn" | "stale";

export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  fresh: "#2ECC71",
  mild: "#F4D03F",
  warn: "#E67E22",
  stale: "#E74C3C",
};

const MS_PER_DAY = 86_400_000;

export function daysSince(date: string | number | Date, now: Date = new Date()): number {
  const then = new Date(date).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / MS_PER_DAY));
}

export function severityForDays(days: number): SeverityLevel {
  if (days >= 60) return "stale";
  if (days >= 30) return "warn";
  if (days >= 7) return "mild";
  return "fresh";
}

export function severityColor(days: number): string {
  return SEVERITY_COLOR[severityForDays(days)];
}

/** Age driving the counter: time since the report was forwarded, else created. */
export function reportAgeDays(
  report: { created_at: string; notified_at?: string | null; resolved_at?: string | null },
  now: Date = new Date(),
): number {
  if (report.resolved_at) {
    const base = report.notified_at ?? report.created_at;
    return daysSince(base, new Date(report.resolved_at));
  }
  return daysSince(report.notified_at ?? report.created_at, now);
}
