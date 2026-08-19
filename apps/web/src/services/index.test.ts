import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { searchService, type SearchInput } from "./index";
import { MAX_RADIUS_KM } from "@/lib/nearest-outside";

// SEMÂNTICA ATUAL: RAIO DURO (decisão do usuário, FIX-P0-RAIO).
//
// Estes testes foram REESCRITOS. A versão anterior afirmava que "Barbearia" +
// São Paulo + 10km devolvia > 0 — isso codificava o fallback que descartava o
// raio quando havia poucos matches. Esse fallback era a causa do P0: o serviço
// devolvia leads a centenas de km, o filterByRadius do cliente reapagava, e a
// tela mostrava 0 depois de um toast dizendo "6 encontradas".
// Agora o raio vale de fato: fora do raio não volta como resultado, volta como
// `nearestOutsideRadius` (campo separado) para o estado vazio explicar o vazio.

const SAO_PAULO = { latitude: -23.5505, longitude: -46.6333 };

function baseInput(overrides: Partial<SearchInput> = {}): SearchInput {
  return {
    niche: "",
    location: "São Paulo",
    latitude: SAO_PAULO.latitude,
    longitude: SAO_PAULO.longitude,
    radiusKm: 10,
    presence: "all",
    ...overrides,
  };
}

let originalRandom: () => number;

beforeEach(() => {
  // maybeFail() tem 8% de chance de lançar — determinístico p/ não flakar.
  originalRandom = Math.random;
  Math.random = () => 0.5;
});

afterEach(() => {
  Math.random = originalRandom;
});

describe("searchService.run — raio duro", () => {
  test("só devolve o que está dentro do raio, nunca uma ocorrência de fora", async () => {
    const radiusKm = 50;
    const { leads } = await searchService.run(baseInput({ niche: "Clínica", radiusKm }));
    for (const lead of leads) {
      expect(lead.distanceKm).toBeLessThanOrEqual(radiusKm);
    }
  });

  test("nicho sem ocorrência dentro do raio devolve VAZIO e aponta a mais próxima", async () => {
    // Oráculo (LOTE 2, Tarefa 2): a fixture ganhou uma barbearia isolada em
    // Guarulhos (~16km de São Paulo) exatamente para que este cenário passe
    // a ter uma "mais próxima" ALCANÇÁVEL (dentro do teto de 50km) — antes
    // dessa fixture a mais próxima era Curitiba, a ~335km, fora do teto.
    const { leads, search } = await searchService.run(
      baseInput({ niche: "Barbearia", radiusKm: 10 }),
    );
    expect(leads).toHaveLength(0);
    expect(search.totalFound).toBe(0);
    expect(search.nearestOutsideRadius).not.toBeNull();
    expect(search.nearestOutsideRadius!.city).toBe("Guarulhos");
    expect(search.nearestOutsideRadius!.distanceKm).toBeGreaterThan(10);
    expect(search.nearestOutsideRadius!.distanceKm).toBeLessThan(50);
  });

  test("a mais próxima é de fato a MENOR distância fora do raio", async () => {
    const radiusKm = 10;
    const { search } = await searchService.run(baseInput({ niche: "Restaurante", radiusKm }));
    const nearest = search.nearestOutsideRadius;
    expect(nearest).not.toBeNull();
    expect(nearest!.distanceKm).toBeGreaterThan(radiusKm);
    // Nenhuma outra ocorrência do mesmo nicho pode estar mais perto que ela.
    const { leads: allWide } = await searchService.run(
      baseInput({ niche: "Restaurante", radiusKm: 99999 }),
    );
    const closest = Math.min(...allWide.map((l) => l.distanceKm));
    expect(nearest!.distanceKm).toBeCloseTo(closest, 1);
  });

  test("raio ampliado o suficiente faz a antes-de-fora entrar", async () => {
    const { search: tight } = await searchService.run(
      baseInput({ niche: "Barbearia", radiusKm: 10 }),
    );
    const distance = tight.nearestOutsideRadius!.distanceKm;

    const { leads: wide } = await searchService.run(
      baseInput({ niche: "Barbearia", radiusKm: Math.ceil(distance) }),
    );
    expect(wide.length).toBeGreaterThan(0);
    expect(wide.some((l) => l.city === "Guarulhos")).toBe(true);
  });

  test("cenário alcançável (LOTE 2): a mais próxima está dentro do teto do raio", async () => {
    // Trava a Tarefa 2 diretamente: sem isso, "Buscar num raio maior" nunca
    // aparece no demo (era exatamente o achado F6 do handoff-spec).
    const { search } = await searchService.run(baseInput({ niche: "Barbearia", radiusKm: 10 }));
    const nearest = search.nearestOutsideRadius!;
    expect(nearest.distanceKm).toBeLessThanOrEqual(MAX_RADIUS_KM);
  });

  test("nicho inexistente: vazio e SEM mais próxima", async () => {
    const { leads, search } = await searchService.run(
      baseInput({ niche: "categoria-inexistente-xyz", radiusKm: 9999 }),
    );
    expect(leads).toHaveLength(0);
    expect(search.nearestOutsideRadius).toBeNull();
  });

  test("presença 'no-website' combinada com nicho aplica as duas condições", async () => {
    const { leads } = await searchService.run(
      baseInput({ niche: "Clínica", presence: "no-website", radiusKm: 50 }),
    );
    for (const lead of leads) {
      expect(lead.category.toLowerCase()).toContain("clínica");
      expect(lead.hasWebsite).toBe(false);
    }
  });

  test("nicho vazio (Todas as categorias) não filtra por categoria", async () => {
    const { leads } = await searchService.run(baseInput({ niche: "", radiusKm: 50 }));
    const categories = new Set(leads.map((l) => l.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  test("os três números concordam no caminho feliz: totalFound = leads = pós-raio", async () => {
    const radiusKm = 50;
    const { leads, search } = await searchService.run(baseInput({ niche: "", radiusKm }));
    expect(leads.length).toBeGreaterThan(0);
    expect(search.totalFound).toBe(leads.length);
    for (const lead of leads) {
      expect(lead.distanceKm).toBeLessThanOrEqual(radiusKm);
    }
  });
});
