import type { Lead, Search, PresenceFilter } from "@/types";
import { MOCK_LEADS } from "@/mocks/leads";
import { suggestCities } from "@/lib/local-geocoding";
import { distanceKm } from "@/lib/geo";
import { getSearchRepository } from "@/repositories";
import type { DiscoveryResult } from "@/repositories";

const delay = (ms = 300 + Math.random() * 400) => new Promise<void>((r) => setTimeout(r, ms));

// Pequena chance controlada de erro para demonstrar estados de falha.
// Desligue com localStorage["radar-local:sim-errors"] = "0".
const maybeFail = (rate = 0.08, message = "Falha simulada na comunicação. Tente novamente.") => {
  if (
    typeof window !== "undefined" &&
    window.localStorage.getItem("radar-local:sim-errors") === "0"
  )
    return;
  if (Math.random() < rate) throw new Error(message);
};

export interface SearchInput {
  niche: string;
  location: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  presence: PresenceFilter;
  /** Quantidade de empresas a encontrar (V3-A). Respeita SEARCH_MAX_RESULTS. */
  maxResults?: number;
  /** "Atualizar": bypass cache, re-fetch from Google (paid). Real mode only. */
  forceRefresh?: boolean;
}

export const searchService = {
  async run(input: SearchInput): Promise<{ leads: Lead[]; search: Search }> {
    await delay(400);
    maybeFail();

    // Aplica nicho e presença digital PRIMEIRO (o que a busca pediu). Filtrar
    // por raio antes do nicho fazia o fallback "expandir pros mais próximos"
    // nunca disparar em cidades grandes (o pool bruto de QUALQUER categoria já
    // batia 10 dentro do raio) — o filtro de nicho então zerava o resultado
    // mesmo havendo leads da categoria buscada só um pouco mais longe.
    const nicheLower = input.niche.toLowerCase();
    const matchesQuery = MOCK_LEADS.filter((l) =>
      input.presence === "no-website"
        ? !l.hasWebsite
        : input.presence === "with-website"
          ? l.hasWebsite
          : true,
    ).filter(
      (l) =>
        nicheLower === "" ||
        l.category.toLowerCase().includes(nicheLower) ||
        l.companyName.toLowerCase().includes(nicheLower),
    );

    // Calcula distância dos leads que batem com a busca até o centro
    const withDistance = matchesQuery.map((l) => ({
      ...l,
      distanceKm: Number(
        distanceKm(
          { lat: input.latitude, lng: input.longitude },
          { lat: l.latitude, lng: l.longitude },
        ).toFixed(1),
      ),
    }));

    // RAIO DURO (decisão do usuário, FIX-P0-RAIO): o raio vale de fato. Não
    // existe mais fallback "se achou pouco, devolve tudo ordenado por
    // distância" — era ele que devolvia leads a centenas de km, que o
    // filterByRadius do cliente reapagava, produzindo "6 encontradas" no toast
    // e 0 na tela. Devolver vazio aqui é a resposta honesta; quem explica o
    // vazio é `nearestOutsideRadius`, em campo separado.
    const final = withDistance.filter((l) => l.distanceKm <= input.radiusKm);

    // Mais próxima FORA do raio — calculada antes do corte, nunca misturada
    // aos resultados. Alimenta só o estado vazio ("a mais próxima está em
    // Curitiba, a 335 km") e a ação de ampliar o raio.
    const nearestOutside = withDistance
      .filter((l) => l.distanceKm > input.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    const withoutSite = final.filter((l) => !l.hasWebsite).length;
    const enriched = final.filter((l) => l.phone || l.whatsapp || l.email).length;

    const search: Search = {
      id: `search-${Date.now()}`,
      niche: input.niche || "Todas as categorias",
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      presence: input.presence,
      createdAt: new Date().toISOString(),
      // Pós-raio: é o conjunto que a tela renderiza. Antes contava o retorno do
      // fallback (pré-filtro do cliente) e por isso discordava da lista.
      totalFound: final.length,
      enrichedCount: enriched,
      addedToPipeline: 0,
      contactsFound: enriched,
      nearestOutsideRadius: nearestOutside
        ? {
            name: nearestOutside.companyName,
            city: nearestOutside.city,
            state: nearestOutside.state,
            distanceKm: nearestOutside.distanceKm,
          }
        : null,
    };
    void withoutSite;

    // Populate the demo discovery cache so the map/list (useDiscoveryResults)
    // see the same data as the leads store — otherwise the map renders
    // "Nenhum resultado" even though the search returned leads.
    const discovery: DiscoveryResult[] = final.map((l) => ({
      placeId: l.id,
      name: l.companyName,
      category: l.category,
      latitude: l.latitude,
      longitude: l.longitude,
      address: l.address,
      neighborhood: l.neighborhood ?? null,
      city: l.city,
      state: l.state,
      phone: l.phone ?? null,
      website: l.website ?? null,
      hasWebsite: l.hasWebsite,
      email: l.email ?? null,
      instagram: l.instagram ?? null,
      whatsapp: l.whatsapp ?? null,
      rating: l.rating ?? null,
      reviewCount: l.reviewCount ?? null,
      distanceKm: l.distanceKm,
      score: l.score,
      temperature: l.temperature,
      importedLeadId: null,
      enrichmentState: "enriched",
      enrichmentFields: null,
      primaryCnae: null,
      cnaeDescription: null,
      secondaryCnaes: null,
      decisionMakerCount: 0,
      topDecisionMakerBand: null,
      topDecisionMakerScore: null,
    }));
    getSearchRepository().registerDiscovery(search.id, discovery);

    return { leads: final, search };
  },
};

export const historyService = {
  suggestLocation(query: string) {
    return suggestCities(query);
  },
};
