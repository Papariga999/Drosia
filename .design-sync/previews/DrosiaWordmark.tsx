import { DrosiaWordmark } from "drosia";

/** Display wordmark with the aqua full-stop, at masthead and header sizes. */
export function Sizes() {
  return (
    <div className="flex flex-col gap-3 text-ink">
      <DrosiaWordmark className="text-[20px]" />
      <span style={{ fontSize: 40 }}>
        <DrosiaWordmark />
      </span>
    </div>
  );
}
