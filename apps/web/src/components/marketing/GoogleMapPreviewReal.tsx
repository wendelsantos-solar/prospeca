/**
 * GoogleMapPreviewReal — Real Google Maps rendering for marketing use.
 * Only loaded lazily when user clicks "Load map" on the preview.
 *
 * Uses the same Google Maps key as the main app (VITE_GOOGLE_MAPS_BROWSER_KEY),
 * restricted by HTTP referrer in Google Cloud Console.
 *
 * Attribution is preserved — Google logo and terms are rendered by the Maps JS API.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MapMarker {
  lat: number;
  lng: number;
  score: number;
  temperature: "hot" | "warm" | "cold";
  label?: string;
}

interface GoogleMapPreviewRealProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  markers?: MapMarker[];
  className?: string;
}

const TEMP_COLORS: Record<string, string> = {
  hot: "#F97316",
  warm: "#EAB308",
  cold: "#3B82F6",
};

declare global {
  interface Window {
    google?: typeof google;
  }
}

export function GoogleMapPreviewReal({
  center,
  radiusKm,
  markers = [],
  className,
}: GoogleMapPreviewRealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }
    if (!ref.current) return;

    let cancelled = false;

    // Use the Google Maps JS API Loader to avoid type issues
    import("@googlemaps/js-api-loader")
      .then(({ Loader }) => {
        if (cancelled) return;
        const loader = new Loader({ apiKey, version: "weekly" });
        return (loader as unknown as { load: () => Promise<void> }).load();
      })
      .then(() => {
        if (cancelled || !ref.current) return;
        const google = window.google;
        if (!google?.maps) {
          setError("Google Maps failed to initialize");
          return;
        }

        const map = new google.maps.Map(ref.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        // Radius circle
        new google.maps.Circle({
          map,
          center,
          radius: radiusKm * 1000,
          fillColor: "#10B981",
          fillOpacity: 0.08,
          strokeColor: "#10B981",
          strokeOpacity: 0.3,
          strokeWeight: 2,
        });

        // Markers
        markers.forEach((m) => {
          new google.maps.Marker({
            position: { lat: m.lat, lng: m.lng },
            map,
            label: {
              text: String(m.score),
              color: "#FFFFFF",
              fontSize: "11px",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: TEMP_COLORS[m.temperature] ?? TEMP_COLORS.warm,
              fillOpacity: 1,
              strokeColor: "#FFFFFF",
              strokeWeight: 2,
              scale: 10,
            },
          });
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Failed to load Google Maps:", err);
          setError("Não foi possível carregar o mapa");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, center, radiusKm, markers]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border bg-surface-2 text-sm text-muted-foreground",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("rounded-xl border border-border", className)}
      aria-label="Mapa interativo de prospecção local"
    />
  );
}
