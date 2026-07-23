import { expect, test } from "bun:test";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "./score";
import type { ScoreInput } from "./score";

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
    name: "V1 sem-site + phone + whatsapp + <=5km + category",
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
    name: "V2 sem-site + <=15km + category, no phone",
    input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 },
    total: 45,
    temp: "warm",
  },
  {
    name: "V3 com-site + phone + whatsapp + <=5km + category",
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
    name: "V4 ceiling",
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
    name: "V5 com-site only, far",
    input: { hasWebsite: true, distanceMeters: 50000 },
    total: 0,
    temp: "cold",
  },
];

test("rule version is v2.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v2.0.0");
});

for (const v of vectors) {
  test(`score vector: ${v.name}`, () => {
    const { total, ruleVersion } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(ruleVersion).toBe("v2.0.0");
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}

test("nearby_5 and nearby_15 are mutually exclusive", () => {
  const at5 = calculateScore({ ...base, distanceMeters: 5000 });
  expect(at5.items.filter((i) => i.key.startsWith("nearby")).length).toBe(1);
  expect(at5.items.find((i) => i.key === "nearby_5")?.points).toBe(10);
});
