import { describe, expect, test } from "bun:test";
import {
  aggregateTerritories,
  buildTerritoryInsights,
  heatMetricWeight,
  heatWeight,
  MIN_TERRITORY_SAMPLE,
  resolveTerritoryGroupBy,
  segmentConcentrationWeight,
  SEGMENT_CONCENTRATION_SATURATION,
  territoryFavorabilityFor,
  territoryKeyForCompany,
  type TerritoryCompany,
} from "./territory";

const c = (
  id: string,
  neighborhood: string,
  score: number,
  hasWebsite: boolean,
  hot = false,
): TerritoryCompany => ({
  id,
  neighborhood,
  city: "Porto Alegre",
  score,
  temperature: hot ? "hot" : "cold",
  hasWebsite,
});

describe("aggregateTerritories", () => {
  test("groups and sorts by count desc", () => {
    const stats = aggregateTerritories([
      c("1", "Centro", 80, false, true),
      c("2", "Centro", 70, false),
      c("3", "Centro", 60, true),
      c("4", "Bom Fim", 50, true),
    ]);
    expect(stats.map((s) => s.key)).toEqual(["Centro", "Bom Fim"]);
    expect(stats[0].companyCount).toBe(3);
    expect(stats[0].withoutWebsite).toBe(2);
    expect(stats[0].avgScore).toBe(70);
  });

  test("skips companies without the group key", () => {
    const stats = aggregateTerritories([c("1", "", 80, false)]);
    expect(stats).toEqual([]);
  });

  test("groups by city when requested", () => {
    const stats = aggregateTerritories(
      [{ ...c("1", "Centro", 80, false), city: "Canoas" }],
      "city",
    );
    expect(stats[0].key).toBe("Canoas");
  });
});

describe("buildTerritoryInsights", () => {
  test("emits digital-gap insight for an above-average region", () => {
    // Centro: 3/3 without site; Bom Fim: 0/3 without site → strong contrast
    const stats = aggregateTerritories([
      c("1", "Centro", 80, false, true),
      c("2", "Centro", 70, false),
      c("3", "Centro", 60, false),
      c("4", "Bom Fim", 50, true),
      c("5", "Bom Fim", 50, true),
      c("6", "Bom Fim", 50, true),
    ]);
    const insights = buildTerritoryInsights(stats);
    const gap = insights.find((i) => i.kind === "digital_gap");
    expect(gap).toBeDefined();
    expect(gap!.territoryKey).toBe("Centro");
    expect(gap!.confidence).toBeGreaterThan(0);
  });

  test("emits nothing when samples are too small", () => {
    const stats = aggregateTerritories([c("1", "Centro", 80, false), c("2", "Bom Fim", 50, true)]);
    expect(buildTerritoryInsights(stats)).toEqual([]);
  });

  test("emits hot-density insight", () => {
    const stats = aggregateTerritories([
      c("1", "Centro", 80, false, true),
      c("2", "Centro", 80, false, true),
      c("3", "Centro", 80, false, true),
      c("4", "Bom Fim", 50, true),
      c("5", "Bom Fim", 50, true),
      c("6", "Bom Fim", 50, true),
    ]);
    const insights = buildTerritoryInsights(stats);
    expect(insights.some((i) => i.kind === "hot_density")).toBe(true);
  });

  test("uses absolute framing when the baseline is near zero (no absurd %)", () => {
    const companies: TerritoryCompany[] = [];
    for (let i = 0; i < 50; i++) companies.push(c(`a${i}`, "Bom Fim", 60, true));
    companies.push(c("b1", "Centro", 60, false));
    companies.push(c("b2", "Centro", 60, false));
    companies.push(c("b3", "Centro", 60, true));
    companies.push(c("b4", "Centro", 60, true));
    companies.push(c("b5", "Centro", 60, true));
    const insights = buildTerritoryInsights(aggregateTerritories(companies));
    const gap = insights.find((i) => i.kind === "digital_gap");
    expect(gap).toBeDefined();
    expect(gap!.message).not.toContain("mais empresas sem site que a média");
    expect(gap!.message).toContain("% das empresas não possuem site");
  });
});

describe("territoryKeyForCompany", () => {
  test("key follows the groupBy field — no per-company fallback", () => {
    expect(territoryKeyForCompany("Centro", "Porto Alegre", "neighborhood")).toBe("Centro");
    expect(territoryKeyForCompany(null, "Porto Alegre", "neighborhood")).toBeNull();
    expect(territoryKeyForCompany("Centro", "Porto Alegre", "city")).toBe("Porto Alegre");
  });
  test("empty/missing → null (company skipped from grouping)", () => {
    expect(territoryKeyForCompany("", null, "neighborhood")).toBeNull();
    expect(territoryKeyForCompany(undefined, "", "city")).toBeNull();
  });
});

describe("resolveTerritoryGroupBy", () => {
  test("neighborhood when any company has one; city otherwise", () => {
    expect(
      resolveTerritoryGroupBy([
        { neighborhood: null, city: "A" },
        { neighborhood: "Centro", city: "A" },
      ]),
    ).toBe("neighborhood");
    expect(
      resolveTerritoryGroupBy([
        { neighborhood: null, city: "A" },
        { neighborhood: "", city: "B" },
      ]),
    ).toBe("city");
  });
});

describe("territoryFavorabilityFor", () => {
  const companies = (): TerritoryCompany[] => [
    c("1", "Centro", 80, false, true),
    c("2", "Centro", 70, false, true),
    c("3", "Centro", 60, false),
    c("4", "Bom Fim", 50, true),
    c("5", "Bom Fim", 50, true),
    c("6", "Bom Fim", 50, true),
  ];

  test("sample below MIN_TERRITORY_SAMPLE → null (component neutral, never invented)", () => {
    const stats = aggregateTerritories([
      c("1", "Centro", 80, false),
      c("2", "Centro", 70, false),
      c("3", "Bom Fim", 50, true),
    ]);
    const insights = buildTerritoryInsights(stats);
    expect(stats.find((s) => s.key === "Centro")!.companyCount).toBeLessThan(MIN_TERRITORY_SAMPLE);
    expect(territoryFavorabilityFor(stats, insights, "Centro")).toBeNull();
  });

  test("unknown key → null", () => {
    const stats = aggregateTerritories(companies());
    expect(territoryFavorabilityFor(stats, buildTerritoryInsights(stats), "Zona Norte")).toBeNull();
  });

  test("only one eligible region → null (no comparative base)", () => {
    const stats = aggregateTerritories([
      c("1", "Centro", 80, false, true),
      c("2", "Centro", 70, false),
      c("3", "Centro", 60, false),
    ]);
    expect(territoryFavorabilityFor(stats, [], "Centro")).toBeNull();
  });

  test("hot + digital-gap region scores higher than its complement", () => {
    const stats = aggregateTerritories(companies());
    const insights = buildTerritoryInsights(stats);
    const centro = territoryFavorabilityFor(stats, insights, "Centro");
    const bomFim = territoryFavorabilityFor(stats, insights, "Bom Fim");
    expect(centro).not.toBeNull();
    expect(bomFim).not.toBeNull();
    // Centro: 2/3 hot, 3/3 sem site vs média baixa → bem mais favorável
    expect(centro!).toBeGreaterThan(bomFim!);
  });

  test("stays within [0,1] and scales with sample confidence", () => {
    const stats = aggregateTerritories(companies());
    const insights = buildTerritoryInsights(stats);
    const favor = territoryFavorabilityFor(stats, insights, "Centro")!;
    expect(favor).toBeGreaterThanOrEqual(0);
    expect(favor).toBeLessThanOrEqual(1);

    // Same composition with a larger sample → higher confidence → higher favor.
    const big: TerritoryCompany[] = [];
    for (let i = 0; i < 8; i++) big.push(c(`x${i}`, "Centro", 80, false, i < 4));
    for (let i = 0; i < 8; i++) big.push(c(`y${i}`, "Bom Fim", 50, true));
    const bigStats = aggregateTerritories(big);
    const bigFavor = territoryFavorabilityFor(
      bigStats,
      buildTerritoryInsights(bigStats),
      "Centro",
    )!;
    expect(bigFavor).toBeGreaterThan(favor);
  });
});

describe("heatWeight", () => {
  test("within [0,1] and monotonic", () => {
    const high = heatWeight({ opportunityScore: 90, confidence: 1, localDensityFactor: 1 });
    const low = heatWeight({ opportunityScore: 10, confidence: 0.2, localDensityFactor: 0.1 });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(1);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe("heatMetricWeight", () => {
  test("opportunity scales with score", () => {
    expect(heatMetricWeight("opportunity", { score: 90, hasWebsite: true })).toBe(0.9);
    expect(heatMetricWeight("opportunity", { score: 0, hasWebsite: true })).toBe(0);
  });
  test("density is constant", () => {
    expect(heatMetricWeight("density", { score: 0, hasWebsite: true })).toBe(1);
  });
  test("weak_digital favours no-website", () => {
    expect(heatMetricWeight("weak_digital", { score: 50, hasWebsite: false })).toBe(1);
    expect(heatMetricWeight("weak_digital", { score: 50, hasWebsite: true })).toBe(0.15);
  });
  test("segment_concentration: share scales up to saturation", () => {
    expect(
      heatMetricWeight("segment_concentration", { score: 50, hasWebsite: true, segmentShare: 0.5 }),
    ).toBe(1);
    expect(
      heatMetricWeight("segment_concentration", {
        score: 50,
        hasWebsite: true,
        segmentShare: 0.25,
      }),
    ).toBe(0.5);
  });
});

describe("segmentConcentrationWeight", () => {
  test("high concentration saturates at 1", () => {
    expect(segmentConcentrationWeight(0.5)).toBe(1);
    expect(segmentConcentrationWeight(0.8)).toBe(1);
    expect(segmentConcentrationWeight(1)).toBe(1);
  });
  test("low concentration scales linearly", () => {
    expect(segmentConcentrationWeight(0.25)).toBe(0.5);
    expect(segmentConcentrationWeight(0.1)).toBeCloseTo(0.2);
  });
  test("absent/zero/invalid share → 0 (never fabricate a hot zone)", () => {
    expect(segmentConcentrationWeight(null)).toBe(0);
    expect(segmentConcentrationWeight(undefined)).toBe(0);
    expect(segmentConcentrationWeight(0)).toBe(0);
    expect(segmentConcentrationWeight(Number.NaN)).toBe(0);
  });
  test("saturation constant is 0.5 (segment dominance)", () => {
    expect(SEGMENT_CONCENTRATION_SATURATION).toBe(0.5);
  });
});
