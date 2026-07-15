import { SeverityPill } from "drosia";

/**
 * The four severity levels — colour comes from `days` via the fixed scale
 * (fresh < 7, mild < 30, warn < 60, stale ≥ 60); `label` is free text.
 */
export function Levels() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SeverityPill days={2} label="Fresh · 2 days" />
      <SeverityPill days={14} label="Ignored 14 days" />
      <SeverityPill days={41} label="Ignored 41 days" />
      <SeverityPill days={88} label="Ignored 88 days" />
    </div>
  );
}

/** As used on a report card next to the category. */
export function OnCard() {
  return <SeverityPill days={23} label="Ignored 23 days" />;
}
