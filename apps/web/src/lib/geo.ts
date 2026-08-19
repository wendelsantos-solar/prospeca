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

/** Narrowing guard for a measurement that may be unknown (NULL) — coordenada
 * ou distância.
 *
 * `Number.isFinite` já era a forma usada no repo (opportunity-heatmap), mas
 * ele NÃO é um type predicate: `Number.isFinite(x)` não estreita
 * `number | null` para `number`, e por isso o guard que já existia no heatmap
 * continuava não compilando depois que o tipo virou nullable. Este wrapper
 * mantém exatamente a mesma semântica (NULL, undefined, NaN e ±Infinity ficam
 * de fora) e devolve o estreitamento que o TypeScript precisa.
 *
 * É a forma única usada por todos os consumidores de coordenada/distância
 * possivelmente desconhecida — "desconhecido" continua desconhecido em vez de
 * virar 0 (Golfo da Guiné para coordenada, "bem aqui" para distância). */
export function isFiniteNumber(v: number | null | undefined): v is number {
  return Number.isFinite(v);
}
