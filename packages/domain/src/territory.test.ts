import { describe, expect, test } from "bun:test";
import {
  aggregateTerritories,
  buildTerritoryInsights,
  heatMetricWeight,
  heatWeight,
  type TerritoryCompany,
} from "./territory";

const c = (id: string, neighborhood: string, score: number, hasWebsite: boolean, hot = false): TerritoryCompany => ({
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
});
