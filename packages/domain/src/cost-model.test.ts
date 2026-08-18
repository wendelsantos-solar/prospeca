// Testes puros do modelo de custo (Fase 7) — tabela de preço, cálculo,
// versionamento e a REGRA DURA: NULL para desconhecido, 0 só comprovadamente
// zero (cache hit / gratuito). Nunca 0 mentindo "sem custo".

import { describe, expect, test } from "bun:test";
import {
  calculateUsageCost,
  costEntryFor,
  COST_TABLE,
  COST_TABLE_VERSION,
} from "./cost-model";

describe("cost table (versão e unicidade)", () => {
  test("tabela tem versão explícita (auditável no tempo)", () => {
    expect(typeof COST_TABLE_VERSION).toBe("number");
    expect(COST_TABLE_VERSION).toBeGreaterThanOrEqual(1);
  });

  test("(provider, operation) é único", () => {
    const keys = COST_TABLE.map((e) => `${e.provider}:${e.operation}`);
    expect(new Set(keys).size).toBe(COST_TABLE.length);
  });

  test("taxas do Google espelham org_mtd_api_cost_usd (0.035/0.020/0.005)", () => {
    expect(costEntryFor("google_places", "place_search_request")?.inputCostUsd).toBe(0.035);
    expect(costEntryFor("google_places", "place_details_request")?.inputCostUsd).toBe(0.02);
    expect(costEntryFor("google_geocoding", "geocode_request")?.inputCostUsd).toBe(0.005);
  });
});

describe("calculateUsageCost — a regra dura NULL vs 0", () => {
  test("custo conhecido: estimado = taxa × quantidade, fonte 'estimated'", () => {
    const c = calculateUsageCost("google_places", "place_search_request", 3);
    expect(c.estimatedCostUsd).toBeCloseTo(0.105, 6);
    expect(c.realCostUsd).toBeNull(); // provider não reportou custo real
    expect(c.source).toBe("estimated");
  });

  test("custo real reportado: real medido vence e fonte vira 'measured'", () => {
    const c = calculateUsageCost("google_places", "place_search_request", 3, {
      realCostUsd: 0.09,
    });
    expect(c.realCostUsd).toBe(0.09);
    expect(c.estimatedCostUsd).toBeCloseTo(0.105, 6);
    expect(c.source).toBe("measured");
  });

  test("cache hit: 0 real E 0 estimado, 'measured' — zero COMPROVADO", () => {
    const c = calculateUsageCost("google_places", "place_search_request", 1, {
      cacheHit: true,
    });
    expect(c.realCostUsd).toBe(0);
    expect(c.estimatedCostUsd).toBe(0);
    expect(c.source).toBe("measured");
    expect(c.cacheHit).toBe(true);
  });

  test("gratuito (taxa 0 na tabela): 0 'measured', distinguível de desconhecido", () => {
    const c = calculateUsageCost("website_scraper", "enrich_request", 5);
    expect(c.realCostUsd).toBe(0);
    expect(c.estimatedCostUsd).toBe(0);
    expect(c.source).toBe("measured");
  });

  test("DESCONHECIDO (taxa null): TUDO null — nunca 0 mentindo", () => {
    const c = calculateUsageCost("anthropic", "ai_message_generate", 1);
    expect(c.realCostUsd).toBeNull();
    expect(c.estimatedCostUsd).toBeNull();
    expect(c.source).toBeNull();
  });

  test("operação fora da tabela: desconhecido (null), nunca 0", () => {
    const c = calculateUsageCost("provider_qualquer", "operacao_qualquer", 10);
    expect(c.realCostUsd).toBeNull();
    expect(c.estimatedCostUsd).toBeNull();
    expect(c.source).toBeNull();
  });
});
