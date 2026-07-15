import { DrosiaMark } from "drosia";

/** Masthead version — brand aqua gradient drop. */
export function Gradient() {
  return <DrosiaMark gradient style={{ height: 72 }} />;
}

/** currentColor version — adapts to its context (here: primary aqua and ink). */
export function CurrentColor() {
  return (
    <div className="flex items-center gap-4">
      <span className="text-primary">
        <DrosiaMark style={{ height: 48 }} />
      </span>
      <span className="text-ink">
        <DrosiaMark style={{ height: 48 }} />
      </span>
      <span className="text-muted">
        <DrosiaMark style={{ height: 48 }} />
      </span>
    </div>
  );
}
