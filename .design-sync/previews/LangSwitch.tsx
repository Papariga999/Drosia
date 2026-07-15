import { LangSwitch } from "drosia";

/**
 * Segmented control while ≤4 locales are active (EL/EN/DE today; EN selected
 * in previews). Automatically becomes a globe dropdown at 5+ locales.
 */
export function Segmented() {
  return <LangSwitch />;
}
