import { severityForDays, SEVERITY_COLOR, type SeverityLevel } from "@/lib/severity";

/** Small severity dot + label pill, e.g. on cards and the tracking header. */
export function SeverityPill({
  days,
  label,
  className = "",
}: {
  days: number;
  label: string;
  className?: string;
}) {
  const level = severityForDays(days);
  const color = SEVERITY_COLOR[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${className}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

/**
 * The big SeverityCounter — the emotional centre of a report.
 * Open: "⏱ Open for <N> days" tinted by severity.
 * Resolved: frozen success state "✅ Fixed after <N> days" in mint.
 */
export function SeverityCounter({
  days,
  resolved,
  openForLabel,
  daysLabel,
  fixedAfterLabel,
}: {
  days: number;
  resolved?: boolean;
  openForLabel: string;
  daysLabel: string;
  fixedAfterLabel: string;
}) {
  if (resolved) {
    return (
      <div className="flex items-baseline gap-2 font-display font-black text-[15px] text-success">
        <span>✅ {fixedAfterLabel}</span>
        <span className="tnum text-[40px] leading-none">{days}</span>
        <span>{daysLabel}</span>
      </div>
    );
  }
  const color = SEVERITY_COLOR[severityForDays(days) as SeverityLevel];
  return (
    <div className="flex items-baseline gap-2 font-display font-black text-[15px] text-slate">
      <span>⏱ {openForLabel}</span>
      <span className="tnum text-[40px] leading-none" style={{ color }}>
        {days}
      </span>
      <span>{daysLabel}</span>
    </div>
  );
}
