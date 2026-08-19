// Intent Match — how well a discovered company matches the search's mission.
//
// Pure, deterministic 0..1 (or null) per company, feeding the
// opportunity-score's `intent_match` component. Honesty rules (spec #7–8,
// #34–35):
//   - ABSENT mission data → null ("aderência não avaliada" — the score
//     component stays neutral at 50, it never fabricates a match);
//   - CLEAR mismatch (resolved category/types exist and don't intersect) → low
//     (0..0.3 range reserved for misses), never a middle value;
//   - No textual fuzzy-match on the raw query — category matching only uses
//     RESOLVED data (canonical_category + places_types persisted by
//     create-search via the taxonomy). The raw query is carried for context
//     only.

export interface SearchMissionIntent {
  /** Raw user query (context only — never matched textually). */
  query?: string | null;
  /** Canonical category resolved by the taxonomy (searches.canonical_category). */
  canonicalCategory?: string | null;
  /** Google Places types resolved for the mission (searches.places_types). */
  placesTypes?: string[];
  /** searches.presence_filter: without_website | with_website | all | null. */
  presenceFilter?: "without_website" | "with_website" | "all" | null;
  /** Search radius in meters (searches.radius_meters). */
  radiusMeters?: number | null;
}

export interface CompanyIntentInput {
  /** places.primary_type (Google primary type). */
  primaryType?: string | null;
  /** places.types (Google types array). */
  types?: string[] | null;
  /** Whether the company has a website (derived from website_uri). */
  hasWebsite: boolean;
  /** Distance from the search center in meters (search_results.distance_meters). */
  distanceMeters?: number | null;
}

// Weights over the components that could be evaluated. Component weights
// redistribute when a dimension is not evaluable (null) — the total stays a
// blend of what was actually observed, never a guess.
const WEIGHTS = { category: 0.5, presence: 0.3, radius: 0.2 } as const;

/** Band reserved for clear mismatches — a miss must never look like "neutral". */
export const INTENT_MISS_MAX = 0.3;

function categoryMatch(mission: SearchMissionIntent, company: CompanyIntentInput): number | null {
  const placesTypes = (mission.placesTypes ?? []).filter(Boolean);
  if (placesTypes.length === 0) return null; // mission has no resolved types
  const companyTypes = [
    ...(company.primaryType ? [company.primaryType] : []),
    ...(company.types ?? []),
  ]
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  if (companyTypes.length === 0) return null; // company type data absent — unknown
  const unique = new Set(companyTypes);
  const matched = placesTypes.some((t) => unique.has(t.toLowerCase()));
  return matched ? 1 : 0; // clear match or clear miss — never in between
}

function presenceMatch(mission: SearchMissionIntent, company: CompanyIntentInput): number | null {
  const filter = mission.presenceFilter;
  if (!filter || filter === "all") return null; // no constraint → not evaluable
  if (filter === "without_website") return company.hasWebsite ? 0 : 1;
  if (filter === "with_website") return company.hasWebsite ? 1 : 0;
  return null;
}

function radiusMatch(mission: SearchMissionIntent, company: CompanyIntentInput): number | null {
  const radius = mission.radiusMeters;
  const distance = company.distanceMeters;
  if (radius == null || radius <= 0 || distance == null) return null; // unknown
  if (distance <= radius) return 1;
  // Outside the radius (a result kept leniently by the pipeline): decay, then
  // clamp to the miss band — far away is a miss, not a coin flip.
  const ratio = distance / radius;
  if (ratio >= 2) return 0;
  return Math.max(0, Math.round((1 - (ratio - 1)) * 10) / 10);
}

/**
 * Overall intent match in [0,1], or null when NOTHING could be evaluated.
 * Components that are not evaluable are dropped and their weight is
 * redistributed, so the result always reflects observed facts only.
 *
 * A CLEAR miss in any evaluated dimension (resolved category mismatch,
 * presence opposite to the mission filter, far outside the radius) caps the
 * result at INTENT_MISS_MAX — a company that violates an essential mission
 * dimension must never score as a strong match on the others.
 */
export function intentMatchForCompany(
  mission: SearchMissionIntent | null | undefined,
  company: CompanyIntentInput,
): number | null {
  if (!mission) return null;

  const evaluated: Array<{ value: number; weight: number }> = [];
  const push = (value: number | null, weight: number) => {
    if (value != null) evaluated.push({ value, weight });
  };
  push(categoryMatch(mission, company), WEIGHTS.category);
  push(presenceMatch(mission, company), WEIGHTS.presence);
  push(radiusMatch(mission, company), WEIGHTS.radius);

  if (evaluated.length === 0) return null;
  const totalWeight = evaluated.reduce((s, e) => s + e.weight, 0);
  const blend = evaluated.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;
  const anyClearMiss = evaluated.some((e) => e.value === 0);
  const raw = anyClearMiss ? Math.min(blend, INTENT_MISS_MAX) : blend;
  return Math.round(raw * 100) / 100;
}
