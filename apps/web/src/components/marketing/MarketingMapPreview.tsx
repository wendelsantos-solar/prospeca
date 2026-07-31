/**
 * MarketingMapPreview — Lazy-loaded Google Maps component for marketing pages.
 *
 * Strategy: show a lightweight CSS-rendered preview first (zero API cost),
 * then load the real interactive map on user interaction (click/hover).
 *
 * When Google Maps is configured (VITE_GOOGLE_MAPS_BROWSER_KEY is set),
 * clicking the preview loads the real map. Without a key, the preview
 * remains static.
 *
 * Usage:
 * ```tsx
 * <MarketingMapPreview
 *   center={{ lat: -22.983, lng: -43.365 }}
 *   radiusKm={10}
 *   markers={demoMarkers}
 *   className="h-96"
 * />
 * ```
 */

import { useState, useCallback, lazy, Suspense, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface MapMarker {
  lat: number;
  lng: number;
  score: number;
  temperature: "hot" | "warm" | "cold";
  label?: string;
}

interface MarketingMapPreviewProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  markers?: MapMarker[];
  className?: string;
  searchLabel?: string;
}

function StaticMapPreview({
  center,
  radiusKm,
  markers = [],
  className,
  searchLabel,
  onLoadInteractive,
}: MarketingMapPreviewProps & { onLoadInteractive?: () => void }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-[oklch(0.955_0.012_156)]",
        className,
      )}
      role="img"
      aria-label={`Mapa de prospecção mostrando ${markers.length} oportunidades na região`}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:22px_22px]" />

      {/* Stylized roads */}
      <div className="absolute left-0 top-[28%] h-px w-full bg-border/50" />
      <div className="absolute left-0 top-[48%] h-px w-full bg-border/50" />
      <div className="absolute left-0 top-[68%] h-px w-full bg-border/50" />
      <div className="absolute left-[30%] top-0 h-full w-px bg-border/50" />
      <div className="absolute left-[60%] top-0 h-full w-px bg-border/50" />

      {/* Search badge */}
      {searchLabel && (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-foreground">{searchLabel}</span>
          </div>
        </div>
      )}

      {/* Radius circle */}
      <div className="absolute left-1/2 top-1/2 h-[55%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/15 bg-primary-subtle/20" />

      {/* Center marker */}
      <div className="absolute left-1/2 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow-md ring-2 ring-primary/30" />

      {/* Lead markers */}
      {markers.map((marker, i) => (
        <div
          key={i}
          className={cn(
            "absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[10px] font-bold shadow-md ring-2 ring-white",
            marker.temperature === "hot" && "bg-hot text-hot-foreground",
            marker.temperature === "warm" && "bg-warm text-warm-foreground",
            marker.temperature === "cold" && "bg-cold text-cold-foreground",
          )}
          style={{
            top: `${30 + Math.random() * 35}%`,
            left: `${25 + Math.random() * 50}%`,
          }}
        >
          {marker.score}
        </div>
      ))}

      {/* Interactive overlay */}
      {onLoadInteractive && (
        <button
          type="button"
          onClick={() => {
            track("map_demo_interacted", {});
            onLoadInteractive();
          }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/0 transition-colors hover:bg-background/10"
          aria-label="Carregar mapa interativo"
        >
          <span className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-card opacity-0 transition-opacity hover:opacity-100">
            Clique para interagir com o mapa
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * MarketingMapPreview — shows a static CSS preview, loads real map on click.
 * Falls back to static preview if Google Maps API key is not configured.
 */
export function MarketingMapPreview(props: MarketingMapPreviewProps) {
  const [interactive, setInteractive] = useState(false);
  const hasGoogleMapsKey = !!import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

  const loadInteractive = useCallback(() => {
    if (hasGoogleMapsKey) setInteractive(true);
  }, [hasGoogleMapsKey]);

  if (interactive && hasGoogleMapsKey) {
    return (
      <Suspense fallback={<StaticMapPreview {...props} />}>
        <LazyGoogleMapPreview {...props} />
      </Suspense>
    );
  }

  return (
    <StaticMapPreview
      {...props}
      onLoadInteractive={hasGoogleMapsKey ? loadInteractive : undefined}
    />
  );
}

/**
 * Lazy Google Maps preview — only loaded when user clicks.
 * Requires VITE_GOOGLE_MAPS_BROWSER_KEY to be set.
 */
const LazyGoogleMapPreview = lazy(() =>
  import("./GoogleMapPreviewReal").then((m) => ({ default: m.GoogleMapPreviewReal })),
);
