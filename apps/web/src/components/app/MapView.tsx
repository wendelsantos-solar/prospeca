import { lazy, Suspense } from "react";
import type { DiscoveryResult } from "@/repositories/types";
import { env } from "@/lib/env";

// Lazy so only the selected renderer's chunk downloads: with a Google Maps
// browser key the app never ships Leaflet + markercluster (and vice-versa).
const GoogleMapView = lazy(() =>
  import("./GoogleMapView").then((m) => ({ default: m.GoogleMapView })),
);
const LeafletMapView = lazy(() =>
  import("./LeafletMapView").then((m) => ({ default: m.LeafletMapView })),
);

/** Provider switch: Google Maps when a browser key is configured, otherwise the
 * OSM/Leaflet renderer (free, no key). Only the active one is bundled/loaded. */
export function MapView({ results }: { results: DiscoveryResult[] }) {
  const Impl = env.googleMapsBrowserKey ? GoogleMapView : LeafletMapView;
  return (
    <Suspense fallback={null}>
      <Impl results={results} />
    </Suspense>
  );
}
