/**
 * design-sync stub for next/navigation — previews and claude.ai/design renders
 * run outside a Next.js runtime. Hooks return inert defaults; BottomNav uses
 * usePathname() only to highlight the active tab.
 */
export function usePathname(): string {
  return "/";
}

export function useRouter() {
  const noop = () => {};
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
}

export function redirect(url: string): never {
  throw new Error(`redirect(${url}) is not available in design previews`);
}

export function notFound(): never {
  throw new Error("notFound() is not available in design previews");
}
