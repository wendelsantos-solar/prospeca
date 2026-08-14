import { describe, expect, test } from "bun:test";
import {
  calculateOpportunityScore,
  confidenceBandFromConfidence,
  CONFIDENCE_BANDS,
  OPPORTUNITY_SCORE_WEIGHTS,
  opportunityTemperatureFromScore,
  type OpportunityScoreInput,
} from "./opportunity-score";
import { deriveSignals } from "./signals";

function input(overrides: Partial<OpportunityScoreInput> = {}): OpportunityScoreInput {
  return {
    signals: deriveSignals({
      hasWebsite: false,
      hasValidPhone: false,
      whatsappStatus: "unknown",
      hasEmail: false,
      rating: null,
      reviewCount: null,
      businessStatus: null,
    }),
    rating: null,
    reviewCount: null,
    hasWebsite: false,
    whatsappStatus: "unknown",
    ...overrides,
  };
}

describe("calculateOpportunityScore", () => {
  test("total stays within 0..100 for extremes", () => {
    const rich = calculateOpportunityScore(
      input({
        signals: deriveSignals({
          hasWebsite: true,
          hasValidPhone: true,
          whatsappStatus: "verified",
          hasEmail: true,
          rating: 4.9,
          reviewCount: 200,
          businessStatus: "OPERATIONAL",
        }),
        rating: 4.9,
        reviewCount: 200,
        hasWebsite: true,
        whatsappStatus: "verified",
        intentMatch: 1,
        territoryFavorability: 1,
        freshnessDays: 1,
      }),
    );
    expect(rich.total).toBeGreaterThanOrEqual(0);
    expect(rich.total).toBeLessThanOrEqual(100);
  });

  test("weights sum to 1", () => {
    const sum = Object.values(OPPORTUNITY_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(1);
  });

  test("points sum equals total", () => {
    const result = calculateOpportunityScore(
      input({ rating: 4.5, reviewCount: 30, intentMatch: 0.7, freshnessDays: 5 }),
    );
    const points = result.components.reduce((a, c) => a + c.points, 0);
    expect(result.total).toBe(points);
  });

  test("digital gap drives the score up for a no-website business", () => {
    const noSite = calculateOpportunityScore(input({ hasWebsite: false }));
    const withSite = calculateOpportunityScore(input({ hasWebsite: true }));
    const gapNoSite = noSite.components.find((c) => c.key === "digital_gap")!.score;
    const gapWithSite = withSite.components.find((c) => c.key === "digital_gap")!.score;
    expect(gapNoSite).toBeGreaterThan(gapWithSite);
  });

  test("per-org intent match changes the total (same company, different org)", () => {
    const high = calculateOpportunityScore(input({ intentMatch: 1 }));
    const low = calculateOpportunityScore(input({ intentMatch: 0 }));
    expect(high.total).toBeGreaterThan(low.total);
  });

  test("confidence grows with more observed dimensions", () => {
    const sparse = calculateOpportunityScore(input({}));
    const rich = calculateOpportunityScore(
      input({
        rating: 4.5,
        reviewCount: 30,
        intentMatch: 0.8,
        territoryFavorability: 0.6,
        freshnessDays: 2,
      }),
    );
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  test("version and confidence are present", () => {
    const result = calculateOpportunityScore(input());
    expect(result.version).toBe("v1.1.0");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.components.length).toBe(Object.keys(OPPORTUNITY_SCORE_WEIGHTS).length);
  });

  test("breakdown carries the confidence band", () => {
    const sparse = calculateOpportunityScore(input({}));
    expect(sparse.confidenceBand).toBe("low"); // floor 0.6, nothing observed
    const rich = calculateOpportunityScore(
      input({ rating: 4.5, reviewCount: 30, intentMatch: 0.8, territoryFavorability: 0.6 }),
    );
    expect(rich.confidenceBand).toBe("high"); // 4 observed → 0.92
  });
});

describe("confidenceBandFromConfidence", () => {
  test("band thresholds: LOW < 0.70 · MEDIUM 0.70–0.84 · HIGH ≥ 0.85", () => {
    expect(confidenceBandFromConfidence(0.699)).toBe("low");
    expect(confidenceBandFromConfidence(CONFIDENCE_BANDS.lowMax)).toBe("medium");
    expect(confidenceBandFromConfidence(0.849)).toBe("medium");
    expect(confidenceBandFromConfidence(CONFIDENCE_BANDS.highMin)).toBe("high");
    expect(confidenceBandFromConfidence(1)).toBe("high");
  });
  test("clamps out-of-range values to the nearest band", () => {
    expect(confidenceBandFromConfidence(0)).toBe("low");
    expect(confidenceBandFromConfidence(1.5)).toBe("high");
  });
});

describe("opportunityTemperatureFromScore", () => {
  test("reuses canonical bands", () => {
    expect(opportunityTemperatureFromScore(84)).toBe("hot");
    expect(opportunityTemperatureFromScore(70)).toBe("warm");
    expect(opportunityTemperatureFromScore(40)).toBe("cold");
  });
});
