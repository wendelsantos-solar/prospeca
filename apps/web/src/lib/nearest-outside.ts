import { RADIUS_OPTIONS } from "@/lib/constants";
import type { NearestOutsideRadius } from "@/types";

/** Teto real do raio: o slider do SearchForm vai até 100 e RADIUS_OPTIONS
 * termina em 100. Existe ocorrência mais longe que isso na base (Curitiba a
 * 335 km de São Paulo), então "ampliar o raio" NEM SEMPRE é possível — e
 * oferecer um botão que não alcança seria a mesma mentira que o P0. */
export const MAX_RADIUS_KM = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];

/**
 * Menor raio da escala que faz a ocorrência mais próxima entrar.
 * Null quando ela está além do raio máximo buscável — nesse caso a UI informa
 * a distância mas NÃO oferece a ação, em vez de ajustar para um valor que
 * continuaria devolvendo vazio.
 */
export function radiusToReach(distanceKm: number): number | null {
  return RADIUS_OPTIONS.find((r) => r >= distanceKm) ?? null;
}

/** "A mais próxima está em Curitiba (PR), a 335 km." — mesma frase na lista e
 * no mapa; as duas telas discordarem sobre o vazio foi parte do defeito. */
export function nearestOutsideDescription(nearest: NearestOutsideRadius): string {
  const distance = nearest.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const reachable = radiusToReach(nearest.distanceKm);
  const where = `A mais próxima está em ${nearest.city} (${nearest.state}), a ${distance} km.`;
  return reachable ? where : `${where} Isso passa do raio máximo de busca (${MAX_RADIUS_KM} km).`;
}
