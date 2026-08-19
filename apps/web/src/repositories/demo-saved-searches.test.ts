// LOTE 4, Tarefa 2 (F2): saveSearch/listSavedSearches do demo eram um no-op
// declarado — a UI disparava toast.success("Busca salva como missão") mesmo
// sem nada persistir, e /app/historico > Buscas salvas nunca mostrava o que
// "foi salvo". Estes testes travam a implementação real (cache em memória,
// mesmo padrão de demoLeads/demoSearches) para que o stub não volte a mentir.

import { describe, expect, test } from "bun:test";
import { DemoSearchRepository } from "./demo";
import type { CreateSearchInput, DiscoveryResult } from "./types";
import type { Search } from "@/types";

function input(overrides: Partial<CreateSearchInput> = {}): CreateSearchInput {
  return {
    query: "Barbearia",
    location: { label: "Porto Alegre, RS", latitude: -30.03, longitude: -51.23 },
    radiusMeters: 10_000,
    presenceFilter: "without_website",
    ...overrides,
  };
}

describe("DemoSearchRepository — stub honesto (LOTE 4 F2)", () => {
  test("saveSearch + listSavedSearches: o que foi salvo aparece na listagem", async () => {
    const repo = new DemoSearchRepository();
    const { searchId } = await repo.create(input());

    expect(await repo.listSavedSearches()).not.toContainEqual(
      expect.objectContaining({ searchId }),
    );

    await repo.saveSearch(searchId, "Missão Barbearia POA");
    const saved = await repo.listSavedSearches();
    const entry = saved.find((s) => s.searchId === searchId);

    expect(entry).toBeDefined();
    expect(entry?.savedName).toBe("Missão Barbearia POA");
    expect(entry?.query).toBe("Barbearia");
    expect(entry?.locationLabel).toBe("Porto Alegre, RS");
    expect(entry?.presenceFilter).toBe("without_website");
    expect(entry?.radiusMeters).toBe(10_000);
  });

  test("nome vazio salva sem apelido (savedName: null), mesma regra do repo real", async () => {
    const repo = new DemoSearchRepository();
    const { searchId } = await repo.create(input());
    await repo.saveSearch(searchId, "   ");
    const entry = (await repo.listSavedSearches()).find((s) => s.searchId === searchId);
    expect(entry?.savedName).toBeNull();
  });

  test("unsaveSearch remove da listagem", async () => {
    const repo = new DemoSearchRepository();
    const { searchId } = await repo.create(input());
    await repo.saveSearch(searchId, "Temporária");
    expect((await repo.listSavedSearches()).some((s) => s.searchId === searchId)).toBe(true);

    await repo.unsaveSearch(searchId);
    expect((await repo.listSavedSearches()).some((s) => s.searchId === searchId)).toBe(false);
  });

  test("estatísticas (hotCount/avgScore/withoutWebsite/totalResults) refletem os resultados reais da busca", async () => {
    const repo = new DemoSearchRepository();
    // "Restaurante" tem múltiplos matches em MOCK_LEADS com mistura de
    // hasWebsite/temperature — presenceFilter "all" não filtra por presença.
    const { searchId } = await repo.create(input({ query: "Restaurante", presenceFilter: "all" }));
    await repo.saveSearch(searchId, "Restaurantes");
    const entry = (await repo.listSavedSearches()).find((s) => s.searchId === searchId)!;

    expect(entry.totalResults).toBeGreaterThan(0);
    expect(entry.hotCount).toBeGreaterThanOrEqual(0);
    expect(entry.avgScore).toBeGreaterThan(0);
    expect(entry.withoutWebsite).toBeGreaterThanOrEqual(0);
    expect(entry.foundCount).toBe(entry.totalResults);
  });

  test("presenceFilter mapeia corretamente nos três valores (demo <-> contrato)", async () => {
    const repo = new DemoSearchRepository();
    const cases: Array<[CreateSearchInput["presenceFilter"], CreateSearchInput["presenceFilter"]]> =
      [
        ["without_website", "without_website"],
        ["with_website", "with_website"],
        ["all", "all"],
      ];
    for (const [filter, expected] of cases) {
      const { searchId } = await repo.create(input({ presenceFilter: filter, query: "Clínica" }));
      await repo.saveSearch(searchId, `missao-${filter}`);
      const entry = (await repo.listSavedSearches()).find((s) => s.searchId === searchId);
      expect(entry?.presenceFilter).toBe(expected);
    }
  });
});

function discoveryResult(overrides: Partial<DiscoveryResult> = {}): DiscoveryResult {
  return {
    placeId: "demo-place-1",
    name: "Barbearia Teste",
    category: "Barbearia",
    latitude: -30.03,
    longitude: -51.23,
    address: null,
    neighborhood: null,
    city: "Porto Alegre",
    state: "RS",
    phone: null,
    website: null,
    hasWebsite: false,
    email: null,
    instagram: null,
    whatsapp: null,
    rating: null,
    reviewCount: null,
    distanceKm: 2.1,
    score: 70,
    temperature: "hot",
    importedLeadId: null,
    enrichmentState: "enriched",
    enrichmentFields: null,
    primaryCnae: null,
    cnaeDescription: null,
    secondaryCnaes: null,
    decisionMakerCount: 0,
    topDecisionMakerBand: null,
    topDecisionMakerScore: null,
    ...overrides,
  };
}

function search(overrides: Partial<Search> = {}): Search {
  return {
    id: "search-real-flow-1",
    niche: "Barbearia",
    location: "Porto Alegre, RS",
    latitude: -30.03,
    longitude: -51.23,
    radiusKm: 10,
    presence: "no-website",
    createdAt: new Date(2026, 0, 1).toISOString(),
    totalFound: 1,
    enrichedCount: 0,
    addedToPipeline: 0,
    contactsFound: 0,
    ...overrides,
  };
}

// O caminho de UI REAL para "salvar missão" (SearchForm/MapToolbar) nunca
// chama repo.create() — quem roda a busca em modo demo é
// services/index.ts:searchService.run(), que registra a busca via
// registerDiscovery(search, discovery), NÃO via create(). Um fix que só
// funcionasse pelo caminho create() (as suítes acima) deixaria "salvar"
// mudo para todo usuário real do demo — foi exatamente esse buraco que o
// primeiro e2e desta tarefa expôs (ver discovery.e2e.ts, "LOTE 4 (F2)").
describe("DemoSearchRepository — caminho real (registerDiscovery, LOTE 4 F2)", () => {
  test("busca registrada via registerDiscovery pode ser salva e aparece na listagem", async () => {
    const repo = new DemoSearchRepository();
    const s = search({ id: "search-rd-1" });
    repo.registerDiscovery(s, [discoveryResult()]);

    await repo.saveSearch(s.id, "Missão via fluxo real");
    const entry = (await repo.listSavedSearches()).find((e) => e.searchId === s.id);

    expect(entry).toBeDefined();
    expect(entry?.savedName).toBe("Missão via fluxo real");
    expect(entry?.query).toBe("Barbearia");
    expect(entry?.locationLabel).toBe("Porto Alegre, RS");
    expect(entry?.totalResults).toBe(1);
  });

  test("registerDiscovery chamado duas vezes para o mesmo id não duplica em listHistory", async () => {
    const repo = new DemoSearchRepository();
    const s = search({ id: "search-rd-2" });
    repo.registerDiscovery(s, [discoveryResult()]);
    repo.registerDiscovery(s, [discoveryResult(), discoveryResult({ placeId: "demo-place-2" })]);

    const history = await repo.listHistory();
    expect(history.filter((h) => h.id === "search-rd-2")).toHaveLength(1);
  });
});
