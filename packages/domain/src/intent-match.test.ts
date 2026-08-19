import { describe, expect, test } from "bun:test";
import { intentMatchForCompany, INTENT_MISS_MAX } from "./intent-match";

const MISSION = {
  query: "barbearias",
  canonicalCategory: "Barbearia",
  placesTypes: ["hair_care", "beauty_salon"],
  presenceFilter: "without_website" as const,
  radiusMeters: 5000,
};

const COMPANY = {
  primaryType: "hair_care",
  types: ["barber_shop"],
  hasWebsite: false,
  distanceMeters: 1200,
};

describe("intentMatchForCompany — categoria", () => {
  test("match claro de tipo → 1 no componente; sem site + dentro do raio → total 1", () => {
    expect(intentMatchForCompany(MISSION, COMPANY)).toBe(1);
  });
  test("miss clara de categoria capa o total em INTENT_MISS_MAX", () => {
    const other = { ...COMPANY, primaryType: "restaurant", types: ["restaurant"] };
    const match = intentMatchForCompany(MISSION, other);
    expect(match).not.toBeNull();
    expect(match!).toBeLessThanOrEqual(INTENT_MISS_MAX);
    expect(match!).toBeGreaterThanOrEqual(0);
  });
  test("company sem dados de tipo → categoria não avaliada (não penaliza)", () => {
    const noTypes = { ...COMPANY, primaryType: null, types: [] };
    // só presença + raio avaliados → ambos match → 1
    expect(intentMatchForCompany(MISSION, noTypes)).toBe(1);
  });
  test("missão sem places_types → categoria nula; presença/raio decidem", () => {
    const mission = { ...MISSION, placesTypes: [] };
    expect(intentMatchForCompany(mission, COMPANY)).toBe(1);
  });
});

describe("intentMatchForCompany — presença", () => {
  test("missão sem-site + empresa com site → miss capada", () => {
    const withSite = { ...COMPANY, hasWebsite: true };
    const match = intentMatchForCompany(MISSION, withSite);
    expect(match).not.toBeNull();
    expect(match!).toBeLessThanOrEqual(INTENT_MISS_MAX);
  });
  test("presenceFilter null/all → componente não avaliado (neutro)", () => {
    const mission = { ...MISSION, presenceFilter: null as null };
    expect(intentMatchForCompany(mission, COMPANY)).toBe(1);
  });
});

describe("intentMatchForCompany — raio", () => {
  test("dentro do raio → 1; ≥2x o raio → miss", () => {
    const near = { ...COMPANY, distanceMeters: 4000 };
    expect(intentMatchForCompany(MISSION, near)).toBe(1);
    const far = { ...COMPANY, distanceMeters: 12000 };
    const match = intentMatchForCompany(MISSION, far);
    expect(match).not.toBeNull();
    expect(match!).toBeLessThanOrEqual(INTENT_MISS_MAX);
  });
  test("distância ausente → componente neutro", () => {
    const unknown = { ...COMPANY, distanceMeters: null };
    expect(intentMatchForCompany(MISSION, unknown)).toBe(1);
  });
});

describe("intentMatchForCompany — honestidade", () => {
  test("missão ausente → null (aderência não avaliada)", () => {
    expect(intentMatchForCompany(null, COMPANY)).toBeNull();
    expect(intentMatchForCompany(undefined, COMPANY)).toBeNull();
  });
  test("missão sem nada avaliável → null", () => {
    const empty = {
      query: "qualquer coisa",
      canonicalCategory: null,
      placesTypes: [],
      presenceFilter: "all" as const,
      radiusMeters: null,
    };
    expect(intentMatchForCompany(empty, COMPANY)).toBeNull();
  });
  test("query crua NUNCA é casada textualmente", () => {
    // query menciona "barbearia" mas sem dados resolvidos → sem match textual.
    const raw = {
      query: "barbearia",
      canonicalCategory: null,
      placesTypes: [],
      presenceFilter: "all" as const,
      radiusMeters: null,
    };
    expect(intentMatchForCompany(raw, COMPANY)).toBeNull();
  });
  test("match parcial: categoria ok + presença ok + raio longe → blend abaixo de 1", () => {
    const mission = { ...MISSION, radiusMeters: 5000 };
    const mid = { ...COMPANY, distanceMeters: 8000 }; // ratio 1.6 → 0.4 no raio
    const match = intentMatchForCompany(mission, mid);
    expect(match).not.toBeNull();
    expect(match!).toBeGreaterThan(INTENT_MISS_MAX);
    expect(match!).toBeLessThan(1);
  });
});
