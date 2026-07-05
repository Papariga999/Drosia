"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, MapPin, Plus } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

/** Persistent app bottom nav with the central camera FAB. Line icons only (no emoji). */
export function BottomNav() {
  const { dict } = useLocale();
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 flex h-[62px] items-center justify-around border-t border-line bg-surface-card px-2">
      <NavItem href="/" icon={<Home size={20} aria-hidden />} label={dict.bottomNav.home} active={path === "/"} />
      <NavItem href="/map" icon={<MapPin size={20} aria-hidden />} label={dict.bottomNav.map} active={path.startsWith("/map")} />
      <Link
        href="/report"
        aria-label={dict.report.cta}
        className="-mt-7 grid h-[46px] w-[46px] place-items-center rounded-2xl bg-primary text-white shadow-btn"
      >
        <Plus size={24} aria-hidden />
      </Link>
      <NavItem href="/urgent" icon={<Flame size={20} aria-hidden />} label={dict.bottomNav.urgent} active={path.startsWith("/urgent")} />
      <NavItem href="/me" icon={<PlacesGlyph />} label={dict.bottomNav.me} active={path.startsWith("/me")} />
    </nav>
  );
}

/** "My places" — Drosia drop over a small base line, in the core icon grammar. */
function PlacesGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5c-3.4 3.6-5.6 6.7-5.6 9.6a5.6 5.6 0 0 0 11.2 0c0-2.9-2.2-6-5.6-9.6Z" />
      <path d="M7 21.5h10" />
    </svg>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 text-center" style={{ color: active ? "var(--primary-ink)" : "var(--muted)" }}>
      {icon}
      <div className="text-[10px] font-bold">{label}</div>
    </Link>
  );
}
