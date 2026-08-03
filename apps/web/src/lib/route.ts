import { distanceKm, type LatLng } from "./geo";

export interface RouteStop {
  id: string;
  lat: number;
  lng: number;
}

export interface OrderedStop extends RouteStop {
  /** Distance in km from the previous stop (or from `origin`, for the first). */
  legKm: number;
}

/**
 * Greedy nearest-neighbor visit order. Good enough for the small stop counts
 * a rep plans in a day (bulk selection is capped at BULK_SELECTION_LIMIT) —
 * an exact TSP solver would be overkill here.
 */
export function optimizeVisitOrder(stops: RouteStop[], origin?: LatLng): OrderedStop[] {
  if (stops.length === 0) return [];

  const remaining = [...stops];
  const ordered: OrderedStop[] = [];
  let current: LatLng;

  if (origin) {
    current = origin;
  } else {
    const first = remaining.shift()!;
    ordered.push({ ...first, legKm: 0 });
    current = { lat: first.lat, lng: first.lng };
  }

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push({ ...next, legKm: bestDist });
    current = { lat: next.lat, lng: next.lng };
  }

  return ordered;
}

/**
 * Google Maps directions URL (api=1 web scheme) — opens in the Maps app on
 * mobile. Origin omitted on purpose when not given: Maps falls back to the
 * device's current location, which is what a rep starting their route wants.
 */
export function buildGoogleMapsRouteUrl(orderedStops: RouteStop[], origin?: LatLng): string {
  if (orderedStops.length === 0) return "";

  const destination = orderedStops[orderedStops.length - 1];
  const waypoints = orderedStops.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Waze Deep Links accept one destination per navigation session. The route UI
 * therefore exposes this action on every ordered stop instead of pretending a
 * multi-stop itinerary can be transferred to Waze.
 */
export function buildWazeNavigationUrl(stop: RouteStop): string {
  const params = new URLSearchParams({
    ll: `${stop.lat},${stop.lng}`,
    navigate: "yes",
    utm_source: "radar_local",
  });

  return `https://www.waze.com/ul?${params.toString()}`;
}
