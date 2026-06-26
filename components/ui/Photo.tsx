/**
 * Anonymized-photo placeholder: a diagonal-hatch scene with a pixelation
 * block, standing in for the real blur pipeline output (faces + plates).
 * Public surfaces ONLY ever render the anonymized variant — never originals.
 */
export function PhotoPlaceholder({
  className = "",
  pixel = true,
  src,
  children,
}: {
  className?: string;
  pixel?: boolean;
  src?: string;
  children?: React.ReactNode;
}) {
  if (src) {
    return (
      <div className={`photo-placeholder relative overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {children}
      </div>
    );
  }
  return (
    <div className={`photo-placeholder relative overflow-hidden ${className}`}>
      {pixel && (
        <div
          aria-hidden
          className="absolute"
          style={{
            left: "32%",
            bottom: "26%",
            width: 54,
            height: 40,
            borderRadius: 4,
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(55,55,55,.55) 0 7px,rgba(110,110,110,.55) 7px 14px),repeating-linear-gradient(90deg,rgba(40,40,40,.3) 0 7px,transparent 7px 14px)",
          }}
        />
      )}
      {children}
    </div>
  );
}
