import { test, expect } from "bun:test";
import { discoveryToPreviewLead } from "./discovery-preview";
import type { DiscoveryResult } from "@/repositories/types";

const base: DiscoveryResult = {
  placeId: "node/123",
  name: "Ecof Contabilidade",
  category: "accountant",
  latitude: -22.9,
  longitude: -43.1,
  phone: "+55 21 9688 49884",
  website: null,
  hasWebsite: false,
  rating: 4.6,
  reviewCount: 12,
  distanceKm: 5.8,
  score: 55,
  temperature: "warm",
  importedLeadId: null,
};

test("maps discovery fields onto a lead-shaped preview object", () => {
  const lead = discoveryToPreviewLead(base);
  expect(lead.id).toBe("node/123");
  expect(lead.companyName).toBe("Ecof Contabilidade");
  expect(lead.category).toBe("accountant");
  expect(lead.latitude).toBe(-22.9);
  expect(lead.longitude).toBe(-43.1);
  expect(lead.phone).toBe("+55 21 9688 49884");
  expect(lead.hasWebsite).toBe(false);
  expect(lead.rating).toBe(4.6);
  expect(lead.reviewCount).toBe(12);
  expect(lead.distanceKm).toBe(5.8);
  expect(lead.score).toBe(55);
  expect(lead.temperature).toBe("warm");
});

test("fills empty collections so lead render paths never crash", () => {
  const lead = discoveryToPreviewLead(base);
  expect(lead.notes).toEqual([]);
  expect(lead.activities).toEqual([]);
  expect(lead.timeline).toEqual([]);
});

test("leaves discovery-absent fields undefined", () => {
  const lead = discoveryToPreviewLead(base);
  expect(lead.whatsapp).toBeUndefined();
  expect(lead.email).toBeUndefined();
  expect(lead.instagram).toBeUndefined();
  expect(lead.neighborhood).toBeUndefined();
  expect(lead.estimatedValue).toBeUndefined();
});

test("null category and website degrade to empty/undefined", () => {
  const lead = discoveryToPreviewLead({ ...base, category: null, website: null });
  expect(lead.category).toBe("");
  expect(lead.website).toBeUndefined();
});

test("website present sets hasWebsite-consistent fields", () => {
  const lead = discoveryToPreviewLead({
    ...base,
    website: "https://ex.com",
    hasWebsite: true,
  });
  expect(lead.website).toBe("https://ex.com");
  expect(lead.hasWebsite).toBe(true);
});
