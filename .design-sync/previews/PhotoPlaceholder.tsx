import { PhotoPlaceholder } from "drosia";

/* PhotoPlaceholder takes no style prop — size it via a wrapper (or className). */
function Frame({ children }: { children: React.ReactNode }) {
  return <div style={{ width: 320, height: 180, borderRadius: 18, overflow: "hidden" }}>{children}</div>;
}

/** Anonymized-photo stand-in: hatched scene + pixelation block. */
export function Default() {
  return (
    <Frame>
      <PhotoPlaceholder pixel className="h-full w-full" />
    </Frame>
  );
}

/** Without the pixel block — plain hatched placeholder. */
export function PlainHatch() {
  return (
    <Frame>
      <PhotoPlaceholder pixel={false} className="h-full w-full" />
    </Frame>
  );
}

/** With overlay children, e.g. the anonymization badge on public photos. */
export function WithBadge() {
  return (
    <Frame>
      <PhotoPlaceholder pixel className="h-full w-full">
        <span
          className="absolute rounded-full text-white"
          style={{ left: 10, bottom: 10, padding: "4px 10px", fontSize: 11, fontWeight: 700, backgroundColor: "rgba(11,43,48,0.72)" }}
        >
          Faces &amp; plates blurred
        </span>
      </PhotoPlaceholder>
    </Frame>
  );
}
