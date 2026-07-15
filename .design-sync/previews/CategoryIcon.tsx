import { CategoryIcon } from "drosia";

const ALL = [
  "illegal_dump",
  "construction_waste",
  "litter",
  "plastic",
  "tires",
  "appliances",
  "vehicle",
  "green_waste",
  "bulky",
  "coast",
  "sewage",
  "other",
] as const;

/** One line icon per report category — 24×24 grid, 2px stroke, currentColor. */
export function AllCategories() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 96px)",
        gap: 16,
        color: "var(--ink)",
      }}
    >
      {ALL.map((c) => (
        <div key={c} className="flex flex-col items-center gap-2 text-center">
          <CategoryIcon category={c} size={28} />
          <span style={{ fontSize: 11 }} className="text-muted">
            {c.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Tinted chip usage, as on report cards — icon inherits currentColor. */
export function InChip() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-tint px-3 py-1.5 text-primary-ink"
      style={{ fontSize: 13, fontWeight: 700 }}
    >
      <CategoryIcon category="illegal_dump" size={18} />
      Illegal dumping
    </span>
  );
}
