import { Button } from "drosia";

/** All four variants, full-width as they render in the app's phone layout. */
export function Variants() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 320 }}>
      <Button variant="primary">Report litter</Button>
      <Button variant="success">Mark as fixed</Button>
      <Button variant="outline">Add another photo</Button>
      <Button variant="disabled">Continue</Button>
    </div>
  );
}

/** Primary CTA as it appears at the end of the report flow. */
export function SubmitCta() {
  return (
    <div style={{ width: 320 }}>
      <Button variant="primary">Send to the municipality</Button>
    </div>
  );
}

