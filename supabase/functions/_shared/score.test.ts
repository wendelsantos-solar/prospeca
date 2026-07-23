import { expect, test } from "bun:test";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "./score.ts";
import type { ScoreInput } from "./score.ts";

const base: ScoreInput = {
  hasWebsite: false,
  hasValidPhone: false,
  whatsappStatus: "unknown",
  hasEmail: false,
  hasInstagram: false,
  hasCategory: false,
  rating: null,
  reviewCount: null,
  distanceMeters: null,
  businessStatus: null,
};

const vectors: Array<{ name: string; input: Partial<ScoreInput>; total: number; temp: string }> = [
  {
    name: "V1",
    input: {
      hasWebsite: false,
      hasValidPhone: true,
      whatsappStatus: "possible",
      hasCategory: true,
      distanceMeters: 3000,
    },
    total: 85,
    temp: "hot",
  },
  {
    name: "V2",
    input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 },
    total: 45,
    temp: "warm",
  },
  {
    name: "V3",
    input: {
      hasWebsite: true,
      hasValidPhone: true,
      whatsappStatus: "possible",
      hasCategory: true,
      distanceMeters: 2000,
    },
    total: 50,
    temp: "warm",
  },
  {
    name: "V4",
    input: {
      hasWebsite: false,
      hasValidPhone: true,
      whatsappStatus: "possible",
      hasCategory: true,
      distanceMeters: 3000,
      hasEmail: true,
      hasInstagram: true,
    },
    total: 100,
    temp: "hot",
  },
  {
    name: "V5",
    input: { hasWebsite: true, distanceMeters: 50000 },
    total: 0,
    temp: "cold",
  },
];

test("edge rule version is v2.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v2.0.0");
});

for (const v of vectors) {
  test(`edge score vector: ${v.name}`, () => {
    const { total } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}
