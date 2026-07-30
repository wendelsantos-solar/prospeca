// Cache key builders — inlined from @leads/domain/cache so edge functions
// bundle without needing the monorepo import map.
// v4: Google-only + Nivel 2 coverage cache (schema + lookup semantics changed).
export const CACHE_VERSION = "v4";

export function roundCoord(value: number, precision = 3): number {
  const f = 10 ** precision;
  return Math.round(value * f) / f;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function categoryKey(category: string): string {
  return slug(category) || "any";
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
