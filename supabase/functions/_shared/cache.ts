// Deno-native cache keys. Mirrors packages/domain/cache.ts (unit-tested).
// Bump on any change to search/query logic so stale payloads are invalidated.
// v3: reverted the tag+name union (Overpass rejected/timed out); back to
// tag-only matching with a name fallback.
export const CACHE_VERSION = "v3";

export function roundCoord(value: number, precision = 3): number {
  const f = 10 ** precision;
  return Math.round(value * f) / f;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function placesCacheKey(input: {
  provider: string;
  category: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  precision?: number;
}): string {
  const lat = roundCoord(input.latitude, input.precision);
  const lng = roundCoord(input.longitude, input.precision);
  return [
    CACHE_VERSION,
    "places",
    slug(input.provider),
    slug(input.category) || "any",
    lat,
    lng,
    input.radiusMeters,
  ].join(":");
}
