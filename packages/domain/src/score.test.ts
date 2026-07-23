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

// v3.0.0 weights: no_website 30, weak_reputation 15 (rating<3.5), low_traction 10
// (reviewCount<20), valid_phone 20, whatsapp 12, email 8, instagram 5, nearby_5 8
// / nearby_15 4, category 3. businessStatus != OPERATIONAL zeros the score.
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
    total: 30 + 20 + 12 + 8 + 3, // 73
    temp: "warm",
  },
  {
    name: "V2 sem-site + <=15km + category, no phone",
    input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 },
    total: 30 + 4 + 3, // 37
    temp: "cold",
  },
  {
    name: "V3 com-site + phone + whatsapp + <=5km + category (maturo → baixo)",
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
    name: "V4 opportunity ceiling (sem-site + nota baixa + poucas reviews + tudo)",
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
    total: 100, // 30+15+10+20+12+8+5+8+3 = 111 → clamp 100
    temp: "hot",
  },
  {
    name: "V5 com-site only, far → zero",
    input: { hasWebsite: true, distanceMeters: 50000 },
    total: 0,
    temp: "cold",
  },
  {
    name: "V6 negócio consolidado (site + nota alta + muitas reviews) pontua baixo",
    input: {
      hasWebsite: true,
      hasValidPhone: true,
      whatsappStatus: "verified",
      hasCategory: true,
      distanceMeters: 4000,
      rating: 4.7,
      reviewCount: 300,
    },
    total: 20 + 12 + 8 + 3, // 43 — sem pontos de oportunidade
    temp: "cold",
  },
  {
    name: "V7 sinais de oportunidade puros (sem-site + nota fraca + baixa tração)",
    input: { hasWebsite: false, rating: 3.0, reviewCount: 10 },
    total: 30 + 15 + 10, // 55
    temp: "warm",
  },
  {
    name: "V8 não-operacional zera tudo (guarda business_status)",
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

test("rule version is v3.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v3.0.0");
});

for (const v of vectors) {
  test(`score vector: ${v.name}`, () => {
    const { total, ruleVersion } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(ruleVersion).toBe("v3.0.0");
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}

test("business_status OPERATIONAL does not trigger the guard", () => {
  const s = calculateScore({ ...base, hasWebsite: false, businessStatus: "OPERATIONAL" });
  expect(s.total).toBe(30); // só no_website
});

test("nearby_5 and nearby_15 are mutually exclusive", () => {
  const at5 = calculateScore({ ...base, distanceMeters: 5000 });
  expect(at5.items.filter((i) => i.key.startsWith("nearby")).length).toBe(1);
  expect(at5.items.find((i) => i.key === "nearby_5")?.points).toBe(8);
});
