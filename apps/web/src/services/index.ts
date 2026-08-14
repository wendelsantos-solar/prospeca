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

    // Calcula distância de todos os leads mock para o centro da busca
    const withDistance = MOCK_LEADS.map((l) => ({
      ...l,
      distanceKm: Number(
        distanceKm(
          { lat: input.latitude, lng: input.longitude },
          { lat: l.latitude, lng: l.longitude },
        ).toFixed(1),
      ),
    }));

    // Filtro por raio (opcional: se raio for muito restritivo, ordena por distância como fallback)
    const withinRadius = withDistance.filter((l) => l.distanceKm <= input.radiusKm);

    // Se o raio capturou poucos leads, expande para os mais próximos (sem limite artificial)
    const base =
      withinRadius.length >= 10
        ? withinRadius
        : withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    // Aplica filtros de presença digital e nicho (match parcial, determinístico)
    const nicheLower = input.niche.toLowerCase();
    const final = base
      .filter((l) =>
        input.presence === "no-website"
          ? !l.hasWebsite
          : input.presence === "with-website"
            ? l.hasWebsite
            : true,
      )
      .filter(
        (l) =>
          nicheLower === "" ||
          l.category.toLowerCase().includes(nicheLower) ||
          l.companyName.toLowerCase().includes(nicheLower),
      );

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
      totalFound: final.length,
      enrichedCount: enriched,
      addedToPipeline: 0,
      contactsFound: enriched,
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
