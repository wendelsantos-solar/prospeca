interface LogoMarkProps {
  className?: string;
}

/** Brand glyph — same artwork as /favicon.svg (concentric locator rings).
 * Renders via currentColor so it works both inside a colored badge box
 * and bare inline next to the wordmark. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="15" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </svg>
  );
}
