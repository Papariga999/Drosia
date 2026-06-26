"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Manual light/dark override on top of the OS default (prefers-color-scheme). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("drosia.theme") as Theme | null;
    if (saved) apply(saved);
    // One-time read of the persisted/OS theme after mount (client-only APIs).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);

  function apply(t: Theme) {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    root.classList.toggle("light", t === "light");
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    window.localStorage.setItem("drosia.theme", next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="grid h-9 w-9 place-items-center rounded-xl bg-surface text-ink transition-colors hover:bg-tint"
    >
      <span aria-hidden>{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}
