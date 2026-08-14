// Search cost estimate — pure, honest RANGES (never an exact promise).
//
// Google Places API (New) Text Search bills per page request (pageSize 20,
// max 3 pages per search in execute-search). A cache-covered search costs
// zero provider calls. Unknown cache state widens the range to [0, max] —
// we never assert a precise cost we cannot know.
//
// Calibration against real usage_events is documented as FUTURE_OPTIMIZATION:
// the per-request price is a versioned constant, bump it when Google's
// pricing table changes.

/** USD per 1000 Text Search requests (Places API New, standard SKU). */
export const GOOGLE_TEXT_SEARCH_COST_PER_1000 = 32;
/** Page size execute-search uses. */
export const TEXT_SEARCH_PAGE_SIZE = 20;
/** Hard technical cap per execution (same as execute-search). */
export const MAX_TEXT_SEARCH_PAGES = 3;

export interface SearchEstimateInput {
  /** Configured max results for the search (searches.max_results). */
  maxResults: number;
  /** true = a covering provider cache exists (zero provider calls);
   * false = paid path; null/undefined = unknown. */
  cacheHit?: boolean | null;
  /** Versioned price constant — override for tests/future SKUs. */
  costPer1000?: number;
}

export interface SearchEstimate {
  /** Expected provider page requests. */
  requestsMin: number;
  requestsMax: number;
  /** USD — range, never a single promised value. */
  costUsdMin: number;
  costUsdMax: number;
  resultsMin: number;
  resultsMax: number;
  cacheHit: boolean;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

export function estimateSearchCost(input: SearchEstimateInput): SearchEstimate {
  const costPer1000 = input.costPer1000 ?? GOOGLE_TEXT_SEARCH_COST_PER_1000;
  const maxResults = Math.max(0, input.maxResults);
  const pagesMax =
    maxResults === 0
      ? 1
      : Math.max(1, Math.min(MAX_TEXT_SEARCH_PAGES, Math.ceil(maxResults / TEXT_SEARCH_PAGE_SIZE)));
  const pagesMin = 1;
  const costPerRequest = costPer1000 / 1000;

  if (input.cacheHit === true) {
    // Fully served by cache: zero provider calls, results already exist.
    return {
      requestsMin: 0,
      requestsMax: 0,
      costUsdMin: 0,
      costUsdMax: 0,
      resultsMin: 0,
      resultsMax: maxResults,
      cacheHit: true,
    };
  }

  const unknown = input.cacheHit === null || input.cacheHit === undefined;
  return {
    requestsMin: unknown ? 0 : pagesMin,
    requestsMax: pagesMax,
    costUsdMin: round4((unknown ? 0 : pagesMin) * costPerRequest),
    costUsdMax: round4(pagesMax * costPerRequest),
    resultsMin: unknown ? 0 : TEXT_SEARCH_PAGE_SIZE,
    resultsMax: pagesMax * TEXT_SEARCH_PAGE_SIZE,
    cacheHit: false,
  };
}
