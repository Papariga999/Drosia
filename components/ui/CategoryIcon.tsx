import type { SVGProps } from "react";
import { Car, HelpCircle, Leaf, Sofa } from "lucide-react";
import type { ReportCategory } from "@/lib/categories";

/**
 * Litter-type icon set (handover 2a) — one line icon per report category.
 * Same grammar as the core set: 24×24 grid, 2px stroke, rounded caps/joins,
 * single color (currentColor). Standard shapes come from Lucide; the
 * litter-specific ones are drawn to match.
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

/** Illegal dumping — tied trash bag with a second bag behind. */
function TrashBags(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 8c-2.6 1.9-4.2 4.9-4.2 7.9C4.8 18.8 7 21 9.9 21s5.1-2.2 5.1-5.1c0-3-1.6-6-4.2-7.9" />
      <path d="m9 8-.9-3.3M10.8 8l.9-3.3M8.1 4.7h3.6" />
      <path d="M17.3 11.6c1.2 1.2 1.9 2.9 1.9 4.5 0 2.1-1.4 3.9-3.4 4.4" />
    </Base>
  );
}

/** Beach litter — parasol over a wave. */
function BeachWave(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3a8 8 0 0 0-8 7.4h16A8 8 0 0 0 12 3Z" />
      <path d="M12 10.4V16" />
      <path d="M3 20c1.5-1.5 3.5-1.5 5 0s3.5 1.5 5 0 3.5-1.5 5 0 2 1 3 .4" />
    </Base>
  );
}

/** Litter — overflowing public bin. */
function OverflowingBin(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5.5 9.5h13" />
      <path d="m7 9.5.8 10a2 2 0 0 0 2 1.9h4.4a2 2 0 0 0 2-1.9l.8-10" />
      <path d="m9 6.5-.7-2.7M12.3 6 12.5 3M15.3 6.7l1.5-2.4" />
    </Base>
  );
}

/** Plastic — bottle. */
function Bottle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10.3 2.5h3.4" />
      <path d="M10.8 2.5v2.6c0 .5-.2 1-.6 1.3l-1 1a3.2 3.2 0 0 0-1 2.3V19a2 2 0 0 0 2 2h3.6a2 2 0 0 0 2-2v-9.3c0-.9-.35-1.7-1-2.3l-1-1a1.9 1.9 0 0 1-.6-1.3V2.5" />
      <path d="M8.2 12.5h7.6M8.2 16.5h7.6" />
    </Base>
  );
}

/** Tires — tire with tread marks. */
function Tire(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m6.2 6.2 2.3 2.3M15.5 15.5l2.3 2.3M6.2 17.8l2.3-2.3M15.5 8.5l2.3-2.3" />
    </Base>
  );
}

/** Appliances — dumped fridge. */
function Fridge(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M7 9.5h10" />
      <path d="M14.5 5.5v1.6M14.5 12.5v2.6" />
    </Base>
  );
}

/** Hazardous waste — barrel with a drip. */
function BarrelDrip(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="6.5" y="3" width="11" height="13" rx="1.5" />
      <path d="M6.5 7.3h11M6.5 11.7h11" />
      <path d="M12 18.4c-.8.9-1.3 1.7-1.3 2.3a1.3 1.3 0 0 0 2.6 0c0-.6-.5-1.4-1.3-2.3Z" />
    </Base>
  );
}

/** Construction debris — bricks. */
function Bricks(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="7.5" width="17" height="11" rx="1" />
      <path d="M3.5 13h17" />
      <path d="M12 7.5V13M8 13v5.5M16 13v5.5" />
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
  vehicle: (p) => <Car size={p.size ?? 18} className={p.className} aria-hidden />,
  green_waste: (p) => <Leaf size={p.size ?? 18} className={p.className} aria-hidden />,
  bulky: (p) => <Sofa size={p.size ?? 18} className={p.className} aria-hidden />,
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
