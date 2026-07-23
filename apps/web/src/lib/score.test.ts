import { test, expect } from "bun:test";
import { scoreInputFromLead, calculateScore } from "./score";
import type { Lead } from "@/types";

const lead = {
  category: "Contabilidade",
  hasWebsite: false,
  phone: "+55 21 99999-8888",
  whatsapp: "+55 21 99999-8888",
  email: undefined,
  instagram: undefined,
  distanceKm: 3,
} as Partial<Lead>;

test("scoreInputFromLead maps a lead to ScoreInput", () => {
  const input = scoreInputFromLead(lead);
  expect(input.hasWebsite).toBe(false);
  expect(input.hasValidPhone).toBe(true);
  expect(input.whatsappStatus).toBe("verified");
  expect(input.hasCategory).toBe(true);
  expect(input.hasEmail).toBe(false);
  expect(input.hasInstagram).toBe(false);
  expect(input.distanceMeters).toBe(3000);
});

test("unified calculateScore scores the mapped lead (v3)", () => {
  const { total } = calculateScore(scoreInputFromLead(lead));
  // v3: sem-site 30 + phone 20 + whatsapp 12 + <=5km 8 + category 3 = 73
  expect(total).toBe(73);
});
