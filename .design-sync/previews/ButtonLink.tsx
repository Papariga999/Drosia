import { ButtonLink } from "drosia";

/** Anchor-styled twin of Button — same variants, navigates instead of submits. */
export function Variants() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 320 }}>
      <ButtonLink href="/report" variant="primary">
        Report litter
      </ButtonLink>
      <ButtonLink href="/map" variant="outline">
        See the map
      </ButtonLink>
    </div>
  );
}

/** Tracking-page CTA linking back into the flow. */
export function TrackCta() {
  return (
    <div style={{ width: 320 }}>
      <ButtonLink href="/r/abc123" variant="success">
        View my report
      </ButtonLink>
    </div>
  );
}
