"use client";

import Link from "next/link";
import { DrosiaMark, DrosiaWordmark } from "@/components/brand/Logo";
import { LangSwitch } from "./LangSwitch";
import { ThemeToggle } from "./ThemeToggle";

/** Public app top bar: logo → home, language switch, theme toggle. */
export function AppBar({ showWordmark = false }: { showWordmark?: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
      <Link href="/" aria-label="Drosia — home" className="flex items-center gap-2 text-primary">
        <DrosiaMark className="h-7 w-auto" gradient />
        {showWordmark && <DrosiaWordmark className="text-[20px]" />}
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <LangSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
