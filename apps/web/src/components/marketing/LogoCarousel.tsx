import { cn } from "@/lib/utils";

/**
 * LogoCarousel — infinite scrolling logo strip, pure CSS.
 * Duplicates content for a seamless loop (no JS animation).
 * Pauses on hover.
 *
 * Uses a mask gradient so logos fade at the edges instead of clipping.
 */

interface LogoCarouselProps {
  /** Label shown above the carousel */
  label: string;
  /** Array of logo elements (images, icons, or text) */
  logos: React.ReactNode[];
  /** Speed in seconds for one full scroll (default 42s) */
  speed?: number;
  className?: string;
}

export function LogoCarousel({ label, logos, speed = 42, className }: LogoCarouselProps) {
  return (
    <div className={cn("py-4", className)}>
      <p className="mb-5 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div
        className="relative overflow-hidden"
        style={{
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
          maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
        }}
      >
        <div
          className="animate-logo-scroll group flex w-max items-center gap-16"
          style={{
            animationDuration: `${speed}s`,
            // @ts-expect-error — custom property read by the parent at hover
            "--_speed": `${speed}s`,
          }}
        >
          {/* First copy */}
          {logos.map((logo, i) => (
            <div
              key={`a-${i}`}
              className="flex shrink-0 items-center gap-2.5 text-sm font-semibold text-muted-foreground"
            >
              {logo}
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {logos.map((logo, i) => (
            <div
              key={`b-${i}`}
              aria-hidden="true"
              className="flex shrink-0 items-center gap-2.5 text-sm font-semibold text-muted-foreground"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>

      {/* Pause on hover — applied via group on the track above */}
      <style>{`
        .animate-logo-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
