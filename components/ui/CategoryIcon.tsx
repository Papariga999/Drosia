import type { SVGProps } from "react";
import { HelpCircle } from "lucide-react";
import type { ReportCategory } from "@/lib/categories";

/**
 * Litter-type icon set (handover 2a) — one line icon per report category.
 * Paths are verbatim from the design file "Drosia Improvements" §2a
 * (24×24 grid, 2px stroke, rounded caps/joins, single currentColor).
 * Categories without a §2a source (tires, appliances) are drawn to the same
 * grammar; §2a icons without a category yet (cigarette butts, dog waste,
 * water pollution) stay in the design file until the enum grows.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Illegal dumping — tied trash bag with a second bag behind (§2a-1). */
function TrashBags(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 9c-3.2 0-5.5 3.2-5.5 6.5V18a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2.5C14.5 12.2 12.2 9 9 9Z" />
      <path d="M7.6 9 6.8 6.5M10.4 9l.8-2.5M6.5 6.5h5" />
      <path d="M16 20h2.5a2 2 0 0 0 2-2v-2c0-2.6-1.6-5-4-5.4" />
      <path d="M17.3 10.7 18 8.8" />
    </Base>
  );
}

/** Beach litter — parasol over a wave (§2a-2). */
function BeachWave(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3a7 7 0 0 1 7 7H5a7 7 0 0 1 7-7Z" />
      <path d="M12 10v7" />
      <path d="M2 20c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" />
    </Base>
  );
}

/** Litter — overflowing public bin (§2a-3). */
function OverflowingBin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 10h14" />
      <path d="M6.2 10 7 20a1.8 1.8 0 0 0 1.8 1.6h6.4A1.8 1.8 0 0 0 17 20l.8-10" />
      <circle cx="9" cy="5.2" r="1.2" />
      <path d="M12.6 6.6 13.6 3.4" />
      <path d="M16 6.8 18 5" />
    </Base>
  );
}

/** Bulky waste — dumped sofa (§2a-4). */
function Sofa(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <path d="M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M5 19v1.5M19 19v1.5" />
    </Base>
  );
}

/** Construction debris — brick stack with dust (§2a-5). */
function Bricks(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="15" width="7" height="5" rx="1" />
      <rect x="13.5" y="15" width="7" height="5" rx="1" />
      <rect x="8.5" y="9" width="7" height="5" rx="1" />
      <path d="M5.5 6.5 6 4.5M12 6V4M18.5 6.5 18 4.5" />
    </Base>
  );
}

/** Sewage / hazard — barrel with a drip (§2a-6 "Hazardous waste"). */
function BarrelDrip(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="3" width="10" height="12.5" rx="1.8" />
      <path d="M7 7.5h10M7 11h10" />
      <path d="M12 22c-1.05 0-1.9-.8-1.9-1.8 0-1.1 1.9-3 1.9-3s1.9 1.9 1.9 3c0 1-.85 1.8-1.9 1.8Z" />
    </Base>
  );
}

/** Plastic — bottle (§2a-7 "Broken glass" outline, without the crack). */
function Bottle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.5 2.5h3" />
      <path d="M11 2.5v4.2L9 10v9a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-9l-2-3.3V2.5" />
    </Base>
  );
}

/** Abandoned vehicle — car (§2a-10). */
function Car(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H8.5c-1 0-1.7.6-2.2 1.4L5 10.5c-1.7.3-3 .9-3 2.5v3c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </Base>
  );
}

/** Green waste — leaf (§2a-11 "Green space"). */
function Leaf(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 21C6 11.5 12 4.5 21 3.5c0 9.5-6 16.5-15 17.5Z" />
      <path d="M6 21c2-6 6-10.5 11-13.5" />
    </Base>
  );
}

/** Tires — tire with tread marks (no §2a source, same grammar). */
function Tire(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6.2 6.2 2.3 2.3M15.5 15.5l2.3 2.3M6.2 17.8l2.3-2.3M15.5 8.5l2.3-2.3" />
    </Base>
  );
}

/** Appliances — dumped fridge (no §2a source, same grammar). */
function Fridge(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M7 9.5h10" />
      <path d="M14.5 5.5v1.6M14.5 12.5v2.6" />
    </Base>
  );
}

const CATEGORY_ICONS: Record<ReportCategory, (props: IconProps) => React.JSX.Element> = {
  illegal_dump: TrashBags,
  construction_waste: Bricks,
  litter: OverflowingBin,
  plastic: Bottle,
  tires: Tire,
  appliances: Fridge,
  vehicle: Car,
  green_waste: Leaf,
  bulky: Sofa,
  coast: BeachWave,
  sewage: BarrelDrip,
  other: (p) => <HelpCircle size={p.size ?? 18} className={p.className} aria-hidden />,
};

/** The category's line icon — monochrome, inherits currentColor. */
export function CategoryIcon({
  category,
  size = 18,
  className,
}: {
  category: ReportCategory;
  size?: number;
  className?: string;
}) {
  const Cmp = CATEGORY_ICONS[category];
  return <Cmp size={size} className={className} />;
}
