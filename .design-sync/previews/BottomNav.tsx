import { BottomNav } from "drosia";

/**
 * Persistent bottom navigation with the raised camera FAB. "Home" reads as
 * active (pathname is "/" in previews); labels come from the locale dictionary.
 */
export function Default() {
  return (
    <div style={{ width: 420, paddingTop: 32 }}>
      <BottomNav />
    </div>
  );
}
