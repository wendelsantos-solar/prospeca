import { describe, expect, test } from "bun:test";
import { normalizeTerm, resolveTaxonomy } from "./taxonomy";
import { SEED_TAXONOMY } from "./taxonomy-data";

describe("resolveTaxonomy", () => {
  test("exact alias match (with accent)", () => {
    const r = resolveTaxonomy("barbearia", SEED_TAXONOMY);
    expect(r?.id).toBe("barbearia");
  });

  test("case/accent-insensitive match", () => {
    expect(resolveTaxonomy("BARBEARIA", SEED_TAXONOMY)?.id).toBe("barbearia");
    expect(resolveTaxonomy("Farmácia", SEED_TAXONOMY)?.id).toBe("farmacia");
  });

  test("substring: 'pizza' resolves to pizzaria", () => {
    expect(resolveTaxonomy("pizza", SEED_TAXONOMY)?.id).toBe("pizzaria");
  });

  test("unmatched term → null", () => {
    expect(resolveTaxonomy("fogueteiro", SEED_TAXONOMY)).toBeNull();
  });

  test("empty term → null", () => {
    expect(resolveTaxonomy("  ", SEED_TAXONOMY)).toBeNull();
  });

  test("places types and cnae are exposed on the match", () => {
    const r = resolveTaxonomy("dentista", SEED_TAXONOMY)!;
    expect(r.placesTypes).toContain("dentist");
    expect(r.cnaeCodes).toContain("8630-5/03");
  });

  test("seed entries are internally consistent", () => {
    for (const e of SEED_TAXONOMY) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.placesTypes.length).toBeGreaterThan(0);
      expect(Array.isArray(e.cnaeCodes)).toBe(true);
    }
  });
});

describe("normalizeTerm", () => {
  test("strips accents and collapses whitespace", () => {
    expect(normalizeTerm("  Salão   de Beleza ")).toBe("salao de beleza");
  });
});
