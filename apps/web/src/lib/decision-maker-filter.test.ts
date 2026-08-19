import { describe, expect, test } from "bun:test";
import { applyAdvancedDiscoveryFilters, DISCOVERY_QUICK_FILTERS } from "./filters";
import type { DiscoveryResult } from "@leads/contracts";

// Fase 15 — decisor acionável na TRIAGEM. O decisor já era resolvido e
// classificado, mas só aparecia abrindo empresa por empresa: numa lista de 60
// resultados não havia como priorizar quem já tem um nome para procurar.

function result(over: Partial<DiscoveryResult>): DiscoveryResult {
  return {
    placeId: "p1",
    name: "Empresa",
    category: "barbearia",
    latitude: 0,
    longitude: 0,
    address: null,
    neighborhood: null,
    city: null,
    state: null,
    phone: null,
    website: null,
    hasWebsite: false,
    email: null,
    instagram: null,
    whatsapp: null,
    rating: null,
    reviewCount: null,
    distanceKm: 1,
    score: 50,
    temperature: "warm",
    importedLeadId: null,
    pipelineState: null,
    enrichmentState: null,
    enrichmentFields: null,
    primaryCnae: null,
    cnaeDescription: null,
    secondaryCnaes: null,
    decisionMakerCount: 0,
    topDecisionMakerBand: null,
    topDecisionMakerScore: null,
    ...over,
  } as DiscoveryResult;
}

const comDecisorAlto = result({
  placeId: "alto",
  decisionMakerCount: 2,
  topDecisionMakerBand: "high",
  topDecisionMakerScore: 100,
});
const comDecisorMedio = result({
  placeId: "medio",
  decisionMakerCount: 1,
  topDecisionMakerBand: "medium",
  topDecisionMakerScore: 65,
});
const semDecisor = result({ placeId: "sem" });

describe("filtro de decisor na descoberta", () => {
  const todos = [comDecisorAlto, comDecisorMedio, semDecisor];

  test("sem filtro, nada é removido", () => {
    expect(applyAdvancedDiscoveryFilters(todos, {})).toHaveLength(3);
  });

  test("'any' mantém quem tem qualquer decisor sustentável", () => {
    const out = applyAdvancedDiscoveryFilters(todos, { decisionMaker: "any" });
    expect(out.map((r) => r.placeId)).toEqual(["alto", "medio"]);
  });

  test("'high' mantém só banda alta", () => {
    const out = applyAdvancedDiscoveryFilters(todos, { decisionMaker: "high" });
    expect(out.map((r) => r.placeId)).toEqual(["alto"]);
  });

  test("empresa sem CNPJ consultado sai do recorte", () => {
    // Contagem 0 inclui "nunca consultei o CNPJ". Ausência de consulta não é
    // evidência de que não há decisor — mas o usuário pediu o recorte de quem
    // JÁ tem um nome para procurar, então sair é o comportamento correto.
    const naoConsultada = result({ placeId: "novo", primaryCnae: null, decisionMakerCount: 0 });
    const out = applyAdvancedDiscoveryFilters([naoConsultada], { decisionMaker: "any" });
    expect(out).toHaveLength(0);
  });

  test("o filtro combina com os demais em vez de substituí-los", () => {
    const altoSemSite = result({
      placeId: "alto-sem-site",
      decisionMakerCount: 1,
      topDecisionMakerBand: "high",
      hasWebsite: false,
    });
    const altoComSite = result({
      placeId: "alto-com-site",
      decisionMakerCount: 1,
      topDecisionMakerBand: "high",
      hasWebsite: true,
    });
    const out = applyAdvancedDiscoveryFilters([altoSemSite, altoComSite], {
      decisionMaker: "high",
      signal: "no_website",
    });
    expect(out.map((r) => r.placeId)).toEqual(["alto-sem-site"]);
  });

  test("filtro rápido 'Com decisor' usa a mesma regra de contagem", () => {
    const quick = DISCOVERY_QUICK_FILTERS.find((f) => f.id === "decision-maker");
    expect(quick).toBeDefined();
    expect(quick!.predicate(comDecisorMedio)).toBe(true);
    expect(quick!.predicate(semDecisor)).toBe(false);
  });
});
