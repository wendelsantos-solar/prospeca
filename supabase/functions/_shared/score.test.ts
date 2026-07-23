import { expect, test } from "bun:test";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "./score.ts";
import type { ScoreInput } from "./score.ts";

// Mirror of packages/domain/src/score.test.ts — keeps the edge copy identical.
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
    total: 30 + 20 + 12 + 8 + 3, // 73
    temp: "warm",
  },
  {
    name: "V2",
    input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 },
    total: 30 + 4 + 3, // 37
    temp: "cold",
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
    total: 20 + 12 + 8 + 3, // 43
    temp: "cold",
  },
  {
    name: "V4 ceiling",
    input: {
      hasWebsite: false,
      hasValidPhone: true,
      whatsappStatus: "possible",
      hasCategory: true,
      distanceMeters: 3000,
      hasEmail: true,
      hasInstagram: true,
      rating: 2.0,
      reviewCount: 5,
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
  {
    name: "V6 consolidado pontua baixo",
    input: {
      hasWebsite: true,
      hasValidPhone: true,
      whatsappStatus: "verified",
      hasCategory: true,
      distanceMeters: 4000,
      rating: 4.7,
      reviewCount: 300,
    },
    total: 20 + 12 + 8 + 3, // 43
    temp: "cold",
  },
  {
    name: "V7 oportunidade pura",
    input: { hasWebsite: false, rating: 3.0, reviewCount: 10 },
    total: 30 + 15 + 10, // 55
    temp: "warm",
  },
  {
    name: "V8 não-operacional zera",
    input: {
      hasWebsite: false,
      hasValidPhone: true,
      distanceMeters: 1000,
      businessStatus: "CLOSED_PERMANENTLY",
    },
    total: 0,
    temp: "cold",
  },
];

test("edge rule version is v3.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v3.0.0");
});

for (const v of vectors) {
  test(`edge score vector: ${v.name}`, () => {
    const { total } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}
