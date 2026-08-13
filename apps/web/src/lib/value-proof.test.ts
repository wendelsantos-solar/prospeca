import { describe, it, expect } from "bun:test";
import { computeValueProof, valueProofSummary } from "./value-proof";
import type { Lead } from "@/types";

const base = (o: Partial<Lead>): Lead => ({
  id: "1",
  companyName: "Test",
  category: "test",
  address: "",
  city: "Porto Alegre",
  state: "RS",
  latitude: -30,
  longitude: -51,
  distanceKm: 1,
  hasWebsite: false,
  score: 50,
  temperature: "warm",
  stage: "new",
  discoveredAt: new Date().toISOString(),
  notes: [],
  activities: [],
  timeline: [],
  ...o,
});

describe("computeValueProof", () => {
  it("counts market-scan signals from the lead data", () => {
    const vp = computeValueProof([
      base({ id: "a", hasWebsite: false, reviewCount: 0 }),
      base({ id: "b", hasWebsite: true, rating: 3.2, reviewCount: 12 }),
      base({ id: "c", hasWebsite: true, rating: 4.8, reviewCount: 90 }),
    ]);
    expect(vp.totalFound).toBe(3);
    expect(vp.withoutWebsite).toBe(1);
    expect(vp.noReviews).toBe(1);
    expect(vp.lowRating).toBe(1);
  });

  it("counts funnel activity and revenue", () => {
    const now = new Date().toISOString();
    const vp = computeValueProof([
      base({ id: "a", lastInteractionAt: now, respondedAt: now, stage: "contacted" }),
      base({ id: "b", stage: "won", closedValue: 2500, meetingAt: now, proposalAt: now }),
    ]);
    expect(vp.contacted).toBe(1);
    expect(vp.responded).toBe(1);
    expect(vp.won).toBe(1);
    expect(vp.revenue).toBe(2500);
  });

  it("collects distinct cities sorted", () => {
    const vp = computeValueProof([
      base({ id: "a", city: "São Paulo" }),
      base({ id: "b", city: "Curitiba" }),
      base({ id: "c", city: "São Paulo" }),
    ]);
    expect(vp.cities).toEqual(["Curitiba", "São Paulo"]);
  });

  it("empty lead set yields zeroes", () => {
    const vp = computeValueProof([]);
    expect(vp.totalFound).toBe(0);
    expect(valueProofSummary(vp)).toContain("na sua região");
  });
});

describe("valueProofSummary", () => {
  it("grounds the copy in the concrete signals", () => {
    const vp = computeValueProof([
      base({ id: "a", hasWebsite: false, reviewCount: 0 }),
      base({ id: "b", hasWebsite: true, rating: 3.0, reviewCount: 5 }),
    ]);
    const text = valueProofSummary(vp);
    expect(text).toContain("Mapeamos 2 negócios");
    expect(text).toContain("não tem site próprio");
    expect(text).toContain("não tem avaliações online");
    expect(text).not.toContain("oportunidade");
  });
});
