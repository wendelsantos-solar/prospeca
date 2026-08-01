import { haversineMeters } from "@leads/geo";

/** Leaflet-compatible coordinate pair (lat/lng). */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometers between two coordinates.
 * Delegates to @leads/geo for the single source of truth. */
export function distanceKm(a: LatLng, b: LatLng): number {
  return (
    haversineMeters({ latitude: a.lat, longitude: a.lng }, { latitude: b.lat, longitude: b.lng }) /
    1000
  );
}
