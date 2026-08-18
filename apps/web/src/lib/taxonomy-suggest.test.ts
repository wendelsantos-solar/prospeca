import { describe, expect, test } from "bun:test";
import { suggestTaxonomy, taxonomyCnaeHint, MAX_TAXONOMY_SUGGESTIONS } from "./taxonomy-suggest";
import { applyAdvancedDiscoveryFilters, hasAdvancedFilters } from "./filters";
import type { DiscoveryResult } from "@leads/contracts";

describe("suggestTaxonomy (V3-A autocomplete)", () => {
  test("matches by name, accent/case-insensitive", () => {
    expect(suggestTaxonomy("barb").some((t) => t.name === "Barbearia")).toBe(true);
    expect(suggestTaxonomy("BARBEARIA").some((t) => t.name === "Barbearia")).toBe(true);
    expect(suggestTaxonomy("salao").some((t) => t.slug === "salao-de-beleza")).toBe(true);
  });

  test("matches aliases (not only the canonical name)", () => {
    const hits = suggestTaxonomy("cabeleireiro");
    expect(hits.some((t) => t.slug === "salao-de-beleza")).toBe(true);
  });

  test("short input (<2 chars) returns no suggestions", () => {
    expect(suggestTaxonomy("b")).toEqual([]);
    expect(suggestTaxonomy("")).toEqual([]);
  });

  test("respects the suggestion limit", () => {
    // broad term that hits many entries
    const hits = suggestTaxonomy("a");
    expect(hits.length).toBeLessThanOrEqual(MAX_TAXONOMY_SUGGESTIONS);
  });

  test("no match → empty (never fabricates)", () => {
    expect(suggestTaxonomy("zzzzqqqq")).toEqual([]);
  });

  test("cnae hint only when the seed carries a code", () => {
    const barbearia = suggestTaxonomy("barbearia")[0];
    expect(barbearia).toBeDefined();
    expect(taxonomyCnaeHint(barbearia!)).toBeTruthy();
  });
});

const r = (o: Partial<DiscoveryResult>): DiscoveryResult => ({
  placeId: "p",
  name: "Teste",
  category: "barbearia",
  latitude: 0,
  longitude: 0,
  address: null,
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  phone: null,
  website: null,
  hasWebsite: false,
  email: null,
  instagram: null,
  whatsapp: null,
  rating: null,
  reviewCount: null,
  distanceKm: 1,
  score: 70,
  temperature: "warm",
  importedLeadId: null,
  enrichmentState: "enriched",
  enrichmentFields: null,
  primaryCnae: null,
  cnaeDescription: null,
  secondaryCnaes: null,
  ...o,
});

describe("applyAdvancedDiscoveryFilters (V3-A)", () => {
  test("no active filters → identity", () => {
    const results = [r({}), r({ city: "Canoas" })];
    expect(applyAdvancedDiscoveryFilters(results, {})).toBe(results);
  });

  test("segment filter is case-insensitive contains", () => {
    const results = [r({}), r({ category: "restaurant" })];
    expect(applyAdvancedDiscoveryFilters(results, { segment: "BARBE" })).toHaveLength(1);
  });

  test("neighborhood/city filters match text", () => {
    const results = [r({}), r({ city: "Canoas", neighborhood: "Centro" })];
    expect(applyAdvancedDiscoveryFilters(results, { city: "cano" })).toHaveLength(1);
    expect(applyAdvancedDiscoveryFilters(results, { neighborhood: "centro" })).toHaveLength(2);
  });

  test("confidence band is EXCLUSIVE — each band its own set, unknown separate", () => {
    const results = [
      r({ opportunityConfidence: 0.92 }), // high
      r({ opportunityConfidence: 0.76 }), // medium
      r({ opportunityConfidence: null }), // unknown
    ];
    expect(applyAdvancedDiscoveryFilters(results, { confidenceBand: "high" })).toHaveLength(1);
    expect(applyAdvancedDiscoveryFilters(results, { confidenceBand: "medium" })).toHaveLength(1);
    expect(applyAdvancedDiscoveryFilters(results, { confidenceBand: "low" })).toHaveLength(0);
    expect(applyAdvancedDiscoveryFilters(results, { confidenceBand: "unknown" })).toHaveLength(1);
  });

  test("enrichment status filter", () => {
    const results = [r({ enrichmentState: "pending" }), r({ enrichmentState: "enriched" })];
    expect(applyAdvancedDiscoveryFilters(results, { enrichmentStatus: "pending" })).toHaveLength(1);
  });

  test("contact signal filters are honest about absence", () => {
    const results = [r({ hasWebsite: false, whatsapp: "+55..." }), r({ hasWebsite: true })];
    expect(applyAdvancedDiscoveryFilters(results, { signal: "no_website" })).toHaveLength(1);
    expect(applyAdvancedDiscoveryFilters(results, { signal: "has_whatsapp" })).toHaveLength(1);
    expect(applyAdvancedDiscoveryFilters(results, { signal: "has_email" })).toHaveLength(0);
  });

  test("hasAdvancedFilters detects active filters", () => {
    expect(hasAdvancedFilters({})).toBe(false);
    expect(hasAdvancedFilters({ city: "" })).toBe(false);
    expect(hasAdvancedFilters({ signal: "no_website" })).toBe(true);
  });
});
