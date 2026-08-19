import { describe, expect, test } from "bun:test";
import { applyAdvancedDiscoveryFilters } from "./filters";
import type { DiscoveryResult } from "@leads/contracts";

// Fase 5 — CNAE acionável. O dado já era coletado e persistido (lookup-cnpj) e
// nunca chegava ao cliente: não dava para buscar nem filtrar por atividade
// econômica. Estes testes fixam a regra de UX: o usuário digita "barbearia",
// não "9602-5/01".

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
    ...over,
  } as DiscoveryResult;
}

const barbearia = result({
  placeId: "barbearia",
  primaryCnae: "9602-5/01",
  cnaeDescription: "Cabeleireiros, manicure e pedicure",
});
const restaurante = result({
  placeId: "restaurante",
  primaryCnae: "5611-2/01",
  cnaeDescription: "Restaurantes e similares",
});
const semConsulta = result({ placeId: "sem-consulta" });

describe("filtro de CNAE (Fase 5)", () => {
  test("casa por DESCRIÇÃO legível — o usuário não precisa saber o código", () => {
    const out = applyAdvancedDiscoveryFilters([barbearia, restaurante], {
      cnae: "manicure",
    });
    expect(out.map((r) => r.placeId)).toEqual(["barbearia"]);
  });

  test("casa por CÓDIGO em prefixo — divisão inteira, não só o código exato", () => {
    const out = applyAdvancedDiscoveryFilters([barbearia, restaurante], {
      cnae: "9602",
    });
    expect(out.map((r) => r.placeId)).toEqual(["barbearia"]);
  });

  test("casa por CNAE secundário", () => {
    const comSecundario = result({
      placeId: "misto",
      primaryCnae: "5611-2/01",
      cnaeDescription: "Restaurantes e similares",
      secondaryCnaes: ["9602-5/01"],
    });
    const out = applyAdvancedDiscoveryFilters([comSecundario], { cnae: "9602" });
    expect(out.map((r) => r.placeId)).toEqual(["misto"]);
  });

  test("é case-insensitive", () => {
    expect(applyAdvancedDiscoveryFilters([barbearia], { cnae: "CABELEIREIROS" })).toHaveLength(1);
  });

  test("resultado SEM CNPJ consultado fica de fora quando o filtro está ativo", () => {
    // Ausência de consulta não é evidência de atividade diferente — mas o
    // usuário pediu um recorte específico, e incluir o desconhecido diluiria
    // o recorte sem avisar.
    const out = applyAdvancedDiscoveryFilters([barbearia, semConsulta], {
      cnae: "9602",
    });
    expect(out.map((r) => r.placeId)).toEqual(["barbearia"]);
  });

  test("sem filtro de CNAE, nada é removido — inclusive o não consultado", () => {
    const out = applyAdvancedDiscoveryFilters([barbearia, restaurante, semConsulta], {});
    expect(out).toHaveLength(3);
  });
});
