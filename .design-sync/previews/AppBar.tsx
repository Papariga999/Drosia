import { AppBar } from "drosia";

/** Default top bar: mark only, language switch + theme toggle right-aligned. */
export function Default() {
  return (
    <div style={{ width: 420 }}>
      <AppBar />
    </div>
  );
}

/** Landing variant with the wordmark next to the mark. */
export function WithWordmark() {
  return (
    <div style={{ width: 420 }}>
      <AppBar showWordmark />
    </div>
  );
}
