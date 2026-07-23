// Cache key builders with coordinate rounding (region bucketing) so equivalent
// nearby searches reuse the same external result. Namespaced + versioned.
// Bump on any change to search/query logic so stale payloads are invalidated.
// v2: Overpass query unions tag selectors + name match (find businesses named X
// but tagged otherwise).
export const CACHE_VERSION = "v2";

/** Round to a grid. precision 2 ≈ 1.1km, 3 ≈ 110m. Default 3. */
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

export function geocodeCacheKey(input: { provider: string; query: string }): string {
  return [CACHE_VERSION, "geocode", slug(input.provider), slug(input.query)].join(":");
}

export function enrichmentCacheKey(input: { provider: string; leadId: string }): string {
  return [CACHE_VERSION, "enrich", slug(input.provider), input.leadId].join(":");
}
