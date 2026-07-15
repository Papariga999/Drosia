import { StatusTimeline } from "drosia";

/** Report forwarded to the authority — the most common mid-flight state. */
export function Forwarded() {
  return (
    <div style={{ width: 400 }}>
      <StatusTimeline
        steps={[
          { label: "Reported", date: "12 Jun", done: true },
          { label: "Forwarded", date: "13 Jun", done: true, current: true },
          { label: "Acknowledged", date: null, done: false },
          { label: "Fixed", date: null, done: false },
        ]}
      />
    </div>
  );
}

/** Fresh report, nothing processed yet. */
export function JustReported() {
  return (
    <div style={{ width: 400 }}>
      <StatusTimeline
        steps={[
          { label: "Reported", date: "Today", done: true, current: true },
          { label: "Forwarded", date: null, done: false },
          { label: "Acknowledged", date: null, done: false },
          { label: "Fixed", date: null, done: false },
        ]}
      />
    </div>
  );
}

/** Happy end — every step done, dates frozen. */
export function Resolved() {
  return (
    <div style={{ width: 400 }}>
      <StatusTimeline
        steps={[
          { label: "Reported", date: "3 May", done: true },
          { label: "Forwarded", date: "4 May", done: true },
          { label: "Acknowledged", date: "12 May", done: true },
          { label: "Fixed", date: "26 May", done: true },
        ]}
      />
    </div>
  );
}
