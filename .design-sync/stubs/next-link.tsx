/**
 * design-sync stub for next/link — previews and claude.ai/design renders run
 * outside a Next.js runtime (no app router mounted, no process.env). Renders
 * the same accessible <a> the real Link renders; navigation props are
 * accepted and ignored. This is a framework shim, not a component rewrite.
 */
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type Href = string | { pathname?: string | null; query?: unknown; hash?: string | null };

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
  legacyBehavior?: boolean;
  passHref?: boolean;
  children?: ReactNode;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, locale, legacyBehavior, passHref, children, ...rest },
  ref,
) {
  const h = typeof href === "string" ? href : (href?.pathname ?? "#");
  return (
    <a ref={ref} href={h} {...rest}>
      {children}
    </a>
  );
});

export default Link;
