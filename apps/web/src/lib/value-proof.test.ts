// Testes puros da Fase 4 — mapeamento do contrato da RPC para a UI.
// Sem banco: apenas a transformação de `allTime` (get_dashboard_overview)
// em ValueProof, que a Prova de Valor consome.

import { describe, expect, test } from "bun:test";
import { valueProofFromAllTime } from "./value-proof";
import type { ValueProofAllTime } from "@/repositories/types";

function allTimeFixture(overrides: Partial<ValueProofAllTime> = {}): ValueProofAllTime {
  return {
    totalFound: 120,
    withoutWebsite: 30,
    noReviews: 20,
    lowRating: 5,
    hot: 12,
    contacted: 40,
    responded: 15,
    meetings: 8,
    proposals: 6,
    won: 4,
    revenue: 40_000,
    cities: ["Belo Horizonte", "Contagem"],
    ...overrides,
  };
}

describe("valueProofFromAllTime", () => {
  test("mapeia todos os campos 1:1 do servidor", () => {
    const at = allTimeFixture();
    const vp = valueProofFromAllTime(at);
    expect(vp.totalFound).toBe(120);
    expect(vp.withoutWebsite).toBe(30);
    expect(vp.noReviews).toBe(20);
    expect(vp.lowRating).toBe(5);
    expect(vp.hot).toBe(12);
    expect(vp.contacted).toBe(40);
    expect(vp.responded).toBe(15);
    expect(vp.meetings).toBe(8);
    expect(vp.proposals).toBe(6);
    expect(vp.won).toBe(4);
    expect(vp.revenue).toBe(40_000);
  });

  test("cidades vêm ordenadas e não mutam a entrada", () => {
    const at = allTimeFixture({ cities: ["Contagem", "Belo Horizonte"] });
    const vp = valueProofFromAllTime(at);
    expect(vp.cities).toEqual(["Belo Horizonte", "Contagem"]);
    expect(at.cities).toEqual(["Contagem", "Belo Horizonte"]);
  });

  test("carteira vazia → prova de valor zerada mas íntegra", () => {
    const vp = valueProofFromAllTime(
      allTimeFixture({
        totalFound: 0,
        withoutWebsite: 0,
        noReviews: 0,
        lowRating: 0,
        hot: 0,
        contacted: 0,
        responded: 0,
        meetings: 0,
        proposals: 0,
        won: 0,
        revenue: 0,
        cities: [],
      }),
    );
    expect(vp.totalFound).toBe(0);
    expect(vp.cities).toEqual([]);
  });

  test("nunca deriva de array truncado — recebe números agregados", () => {
    // Contrato estrutural: a função NÃO aceita leads; só o agregado do servidor.
    // Se alguém voltar a passar um array, o typecheck quebra (não há caminho).
    expect(valueProofFromAllTime(allTimeFixture()).totalFound).toBe(120);
  });
});
