/** 3-step report timeline: Reported → Forwarded → Resolved. */
export function StatusTimeline({
  steps,
}: {
  steps: { label: string; date: string | null; done: boolean; current?: boolean }[];
}) {
  return (
    <div className="flex items-start">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-start">
          <div className="flex-1 text-center">
            <div
              className="mx-auto h-[18px] w-[18px] rounded-full border-2"
              style={{
                backgroundColor: s.done ? "var(--primary)" : "var(--surface-card)",
                borderColor: s.done ? "var(--primary)" : "var(--border-strong)",
                boxShadow: s.current ? "0 0 0 4px var(--tint)" : "none",
              }}
            />
            <div
              className={`mt-1.5 text-[12px] font-bold ${s.done ? "text-ink" : "text-muted"}`}
            >
              {s.label}
            </div>
            <div className="tnum text-[11px] text-muted">{s.date ?? "—"}</div>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mt-2 h-[2px] flex-1"
              style={{ backgroundColor: s.done ? "var(--primary)" : "var(--border-strong)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
