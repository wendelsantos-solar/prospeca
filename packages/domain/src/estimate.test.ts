import { describe, expect, test } from "bun:test";
import {
  estimateSearchCost,
  GOOGLE_TEXT_SEARCH_COST_PER_1000,
  MAX_TEXT_SEARCH_PAGES,
  TEXT_SEARCH_PAGE_SIZE,
} from "./estimate";

describe("estimateSearchCost", () => {
  test("paid path: pages = ceil(maxResults/pageSize), capped at 3", () => {
    const small = estimateSearchCost({ maxResults: 20, cacheHit: false });
    expect(small.requestsMin).toBe(1);
    expect(small.requestsMax).toBe(1);
    expect(small.costUsdMin).toBe(
      Math.round((GOOGLE_TEXT_SEARCH_COST_PER_1000 / 1000) * 10000) / 10000,
    );
    expect(small.resultsMax).toBe(TEXT_SEARCH_PAGE_SIZE);

    const big = estimateSearchCost({ maxResults: 60, cacheHit: false });
    expect(big.requestsMax).toBe(MAX_TEXT_SEARCH_PAGES);
    expect(big.resultsMax).toBe(MAX_TEXT_SEARCH_PAGES * TEXT_SEARCH_PAGE_SIZE);
  });

  test("cache hit → zero cost, zero requests", () => {
    const e = estimateSearchCost({ maxResults: 60, cacheHit: true });
    expect(e.cacheHit).toBe(true);
    expect(e.requestsMin).toBe(0);
    expect(e.requestsMax).toBe(0);
    expect(e.costUsdMin).toBe(0);
    expect(e.costUsdMax).toBe(0);
  });

  test("unknown cache state → honest [0, max] range", () => {
    const e = estimateSearchCost({ maxResults: 60 });
    expect(e.requestsMin).toBe(0);
    expect(e.costUsdMin).toBe(0);
    expect(e.costUsdMax).toBeGreaterThan(0);
    expect(e.resultsMin).toBe(0);
  });

  test("range is always min ≤ max and max ≤ 3-page cost", () => {
    for (const maxResults of [0, 1, 19, 20, 21, 60, 200]) {
      for (const cacheHit of [true, false, null, undefined]) {
        const e = estimateSearchCost({ maxResults, cacheHit: cacheHit ?? undefined });
        expect(e.costUsdMin).toBeLessThanOrEqual(e.costUsdMax);
        expect(e.resultsMin).toBeLessThanOrEqual(e.resultsMax);
        expect(e.requestsMax).toBeLessThanOrEqual(MAX_TEXT_SEARCH_PAGES);
      }
    }
  });

  test("never promises an exact value — min < max on the paid path", () => {
    const e = estimateSearchCost({ maxResults: 60, cacheHit: false });
    expect(e.costUsdMin).toBeLessThan(e.costUsdMax);
  });

  test("cost scales linearly with the price constant (override)", () => {
    const a = estimateSearchCost({ maxResults: 20, cacheHit: false, costPer1000: 10 });
    const b = estimateSearchCost({ maxResults: 20, cacheHit: false, costPer1000: 20 });
    expect(b.costUsdMax).toBe(a.costUsdMax * 2);
  });
});
