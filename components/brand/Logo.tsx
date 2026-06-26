import type { SVGProps } from "react";

/**
 * Drosia mark — a tau/dew drop whose tip doubles as a map-pin
 * (freshness + location/report in one sign). Default fill follows
 * currentColor so it adapts to context; pass `gradient` for the
 * brand aqua gradient used on the masthead.
 */
export function DrosiaMark({
  gradient = false,
  title = "Drosia",
  ...props
}: SVGProps<SVGSVGElement> & { gradient?: boolean; title?: string }) {
  const id = "drosia-drop";
  return (
    <svg
      viewBox="0 0 48 64"
      fill="none"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {gradient && (
        <defs>
          <linearGradient id={id} x1="10" y1="6" x2="40" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1ECAD9" />
            <stop offset="1" stopColor="#00A6BC" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M24 3C13.5 3 5 11.3 5 21.6 5 35 24 61 24 61s19-26 19-39.4C43 11.3 34.5 3 24 3Z"
        fill={gradient ? `url(#${id})` : "currentColor"}
      />
      <circle cx="24" cy="21" r="8.4" fill="var(--surface-card, #F2FBFC)" />
      <ellipse
        cx="18.5"
        cy="14.5"
        rx="3.6"
        ry="2.3"
        fill="#ffffff"
        opacity="0.55"
        transform="rotate(-32 18.5 14.5)"
      />
    </svg>
  );
}

/** Wordmark: "Drosia" with the aqua full-stop. */
export function DrosiaWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-black tracking-display leading-none ${className}`}
    >
      Drosia<span className="text-primary">.</span>
    </span>
  );
}
