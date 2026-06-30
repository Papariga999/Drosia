"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

/** Persistent app bottom nav with the central camera FAB. */
export function BottomNav() {
  const { dict } = useLocale();
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 flex h-[62px] items-center justify-around border-t border-line bg-surface-card px-2">
      <NavItem href="/" icon="🏠" label={dict.bottomNav.home} active={path === "/"} />
      <NavItem href="/map" icon="📍" label={dict.bottomNav.map} active={path.startsWith("/map")} />
      <Link
        href="/report"
        aria-label={dict.report.cta}
        className="-mt-7 grid h-[46px] w-[46px] place-items-center rounded-2xl bg-primary text-[22px] text-white shadow-btn"
      >
        ＋
      </Link>
      <NavItem href="/urgent" icon="🔥" label={dict.bottomNav.urgent} active={path.startsWith("/urgent")} />
      <NavItem href="/me" icon="💧" label={dict.bottomNav.me} active={path.startsWith("/me")} />
    </nav>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className="text-center" style={{ color: active ? "var(--primary-ink)" : "var(--muted)" }}>
      <div className="text-[18px]">{icon}</div>
      <div className="text-[10px] font-bold">{label}</div>
    </Link>
  );
}
