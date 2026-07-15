import { SeverityCounter } from "drosia";

/** Open report — the day count takes the severity colour (47 → warn orange). */
export function Open() {
  return (
    <SeverityCounter days={47} openForLabel="Open for" daysLabel="days" fixedAfterLabel="Fixed after" />
  );
}

/** Fresh report — same layout, mint-green count (2 days → fresh). */
export function OpenFresh() {
  return (
    <SeverityCounter days={2} openForLabel="Open for" daysLabel="days" fixedAfterLabel="Fixed after" />
  );
}

/** Resolved — counter frozen in the success state. */
export function Resolved() {
  return (
    <SeverityCounter
      days={12}
      resolved
      openForLabel="Open for"
      daysLabel="days"
      fixedAfterLabel="Fixed after"
    />
  );
}
