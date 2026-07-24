// search-pipeline: pure business rules extracted from execute-search (C2).
// Testable without Supabase or paid API calls — injectable via adapter ports.

import { calculateScore, temperatureFromScore, type ScoreBreakdown } from "../_shared/score.ts";
import { scoreInputFromPlace } from "../_shared/score-input.ts";
import { hasRealWebsite } from "../_shared/normalize.ts";
import { haversineMeters, type LatLng } from "../_shared/geo.ts";
import type { GooglePlace } from "../_shared/google.ts";

// ── Ports (injected by the handler) ──────────────────────────────────

export interface PlacesPort {
  /** Call the provider (Google) and return places. Increments usage counters. */
  fetchFromProvider(params: {
    textQuery: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    maxPages: number;
    maxResults: number;
  }): Promise<{ places: GooglePlace[]; requestCount: number }>;
}

export interface CachePort {
  /** Try to read an exact cache hit. Returns null on miss. */
  readExact(key: string): Promise<GooglePlace[] | null>;
  /** Try a coverage read (larger circle contains this one). */
  readCoverage(key: string, center: LatLng, radiusMeters: number): Promise<GooglePlace[] | null>;
  /** Write the exact cache entry. */
  writeExact(
    key: string,
    places: GooglePlace[],
    center: LatLng,
    radiusMeters: number,
  ): Promise<void>;
  /** Check force-refresh cooldown. Returns true if force is allowed. */
  canForceRefresh(key: string): Promise<boolean>;
}

export interface SearchStore {
  /** Update search status + metadata. */
  updateStatus(searchId: string, patch: Record<string, unknown>): Promise<void>;
  /** Read the current search row. */
  getSearch(searchId: string): Promise<Record<string, unknown> | null>;
  /** Read org budget info. */
  getOrgBudget(orgId: string): Promise<number | null>;
  /** Read month-to-date API cost for org. */
  getMtdCost(orgId: string): Promise<number>;
}

// ── Source decision ──────────────────────────────────────────────────

export type SearchSource = "cache-exact" | "cache-coverage" | "reuse" | "provider" | "capped";

export interface SourceDecision {
  source: SearchSource;
  places: GooglePlace[];
  requestCount: number;
}

/**
 * Decide where the places come from, in priority order:
 *   reuse → cache-exact → cache-coverage → provider → budget-capped
 *
 * Pure: receives ports and computed keys; returns a decision. The handler
 * applies it by calling the right port method and upserting cache rows.
 */
export async function decideSource(
  params: {
    forceRefresh: boolean;
    cacheKey: string;
    textQuery: string;
    center: LatLng;
    radiusMeters: number;
  },
  cache: CachePort,
  budget: { limit: number | null; mtdCost: number },
): Promise<SourceDecision> {
  const { forceRefresh, cacheKey, textQuery, center, radiusMeters } = params;

  // 1. Force refresh with cooldown guard.
  let doForce = false;
  if (forceRefresh) {
    doForce = await cache.canForceRefresh(cacheKey);
  }

  if (!doForce) {
    // 2. Exact cache hit.
    const exact = await cache.readExact(cacheKey);
    if (exact) return { source: "cache-exact", places: exact, requestCount: 0 };

    // 3. Coverage cache (larger circle contains this one).
    const coverage = await cache.readCoverage(cacheKey, center, radiusMeters);
    if (coverage) return { source: "cache-coverage", places: coverage, requestCount: 0 };
  }

  // 4. Budget gate.
  if (budget.limit != null && budget.mtdCost >= budget.limit) {
    return { source: "capped", places: [], requestCount: 0 };
  }

  // 5. Pay the provider.
  return { source: "provider", places: [], requestCount: 0 };
}

// ── Place filtering & scoring pipeline ───────────────────────────────

export interface ProcessedPlace {
  placeId: string;
  placeRow: Record<string, unknown>;
  distance: number | null;
  inside: boolean;
  position: number;
  score: number;
  temperature: "hot" | "warm" | "cold";
  breakdown: ScoreBreakdown;
}

export interface PipelineInput {
  collected: GooglePlace[];
  organizationId: string;
  providerName: string;
  center: LatLng;
  radiusMeters: number;
  presenceFilter: string | null;
  now: string;
  refreshAfter: string;
}

/**
 * Filter, deduplicate, score and build place+result rows from raw Google results.
 * Pure except for the scoring functions (already tested).
 */
export function selectPlaces(input: PipelineInput): {
  placeRows: Record<string, unknown>[];
  resultMeta: ProcessedPlace[];
} {
  const {
    collected,
    organizationId,
    providerName,
    center,
    radiusMeters,
    presenceFilter,
    now,
    refreshAfter,
  } = input;
  const [centerLng, centerLat] = center;

  const placeRows: Record<string, unknown>[] = [];
  const resultMeta: ProcessedPlace[] = [];
  const seen = new Set<string>();
  let position = 0;

  for (const place of collected) {
    position++;
    if (!place.id || seen.has(place.id)) continue;

    const lat = place.location?.latitude ?? null;
    const lng = place.location?.longitude ?? null;
    const distance =
      lat != null && lng != null ? haversineMeters(centerLat, centerLng, lat, lng) : null;
    const inside = distance != null ? distance <= radiusMeters : false;

    // Radius cut.
    if (distance != null && !inside) continue;

    // Presence filter.
    const websiteReal = hasRealWebsite(place.websiteUri);
    if (presenceFilter === "without_website" && websiteReal) continue;
    if (presenceFilter === "with_website" && !websiteReal) continue;

    seen.add(place.id);

    placeRows.push({
      organization_id: organizationId,
      provider: providerName,
      provider_place_id: place.id,
      name: place.displayName?.text ?? "Sem nome",
      primary_type: place.primaryType ?? null,
      types: place.types ?? [],
      formatted_address: place.formattedAddress ?? null,
      location: lat != null && lng != null ? `POINT(${lng} ${lat})` : null,
      national_phone_number: place.nationalPhoneNumber ?? null,
      international_phone_number: place.internationalPhoneNumber ?? null,
      website_uri: place.websiteUri ?? null,
      google_maps_uri: place.googleMapsUri ?? null,
      business_status: place.businessStatus ?? null,
      rating: place.rating ?? null,
      user_rating_count: place.userRatingCount ?? null,
      provider_fetched_at: now,
      provider_refresh_after: refreshAfter,
    });

    const breakdown = calculateScore(scoreInputFromPlace(place, distance));
    resultMeta.push({
      placeId: place.id,
      placeRow: placeRows[placeRows.length - 1],
      distance,
      inside,
      position,
      score: breakdown.total,
      temperature: temperatureFromScore(breakdown.total),
      breakdown,
    });
  }

  return { placeRows, resultMeta };
}

// ── Result row builder ───────────────────────────────────────────────

export function buildResultRows(
  meta: ProcessedPlace[],
  placeIdMap: Map<string, string>,
  searchId: string,
  matchedQuery: string,
): Record<string, unknown>[] {
  return meta
    .filter((m) => placeIdMap.has(m.placeId))
    .map((m) => ({
      search_id: searchId,
      place_id: placeIdMap.get(m.placeId),
      distance_meters: m.distance,
      position: m.position,
      provider_rank: m.position,
      matched_query: matchedQuery,
      is_inside_radius: m.inside,
      score: m.score,
      temperature: m.temperature,
      score_breakdown: m.breakdown,
    }));
}
