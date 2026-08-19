import type { DiscoveryResult } from "@/repositories/types";

/** Ordenações reais sobre DiscoveryResult (não confundir com SortValue de
 * lib/constants.ts, que ordena Lead[] do funil — domínios diferentes,
 * campos diferentes). "Melhor oportunidade" = score-desc; as demais
 * correspondem a distance-asc / rating-desc / reviews-desc. */
export type DiscoverySortBy = "score" | "distance" | "rating" | "reviews";

export const DISCOVERY_SORT_OPTIONS: Array<{ value: DiscoverySortBy; label: string }> = [
  { value: "score", label: "Melhor oportunidade" },
  { value: "distance", label: "Mais próximo" },
  { value: "rating", label: "Melhor avaliação" },
  { value: "reviews", label: "Mais avaliações" },
];

/** FASE C2: fonte ÚNICA de ordenação de resultados de descoberta — o painel
 * (AppSidebar) e a lista principal (ResultsList, via app.mapa.tsx) usavam
 * cada um a sua própria cópia desta lógica, e por isso a MESMA busca
 * aparecia em ordens diferentes nas duas superfícies. Mesma classe de erro
 * de found_count/sinal duplicados que motivou lotes anteriores — não
 * duplique esta função de novo; importe-a. */
export function sortDiscoveryResults(
  results: DiscoveryResult[],
  sortBy: DiscoverySortBy,
): DiscoveryResult[] {
  const arr = [...results];
  if (sortBy === "score") arr.sort((a, b) => b.score - a.score);
  // Sem distância conhecida vai para o FIM (Infinity), nunca para o topo —
  // que é onde um `?? 0` colocaria: "desconhecido" apareceria como o mais
  // perto de todos.
  if (sortBy === "distance")
    arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  if (sortBy === "rating") arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sortBy === "reviews") arr.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  return arr;
}
