import { useLeadsStore, useSearchDraftStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { distanceKm } from "@/lib/geo";
import { reverseGeocodeCoords } from "@/lib/reverse-geocode";

/**
 * "Buscar nesta área" (Fase final) — executa a busca centrada no ponto do
 * mapa. REGRA DURA PRESERVADA: esta função roda SÓ no clique do botão da
 * barra — o pan NUNCA dispara busca (place_search_request 0.035, Fase 7).
 * Mantém o formulário coerente: o draft ganha o centro + label do reverse
 * geocode antes do radarSearchAt.
 */
export async function searchHereAt(center: { lat: number; lng: number }) {
  const label = (await reverseGeocodeCoords(center.lat, center.lng)) ?? "Área selecionada no mapa";
  useSearchDraftStore.getState().setDraft({
    location: label,
    coords: { lat: center.lat, lng: center.lng },
  });
  useSearchSession.getState().radarSearchAt(center.lat, center.lng, label);
}

/** True quando o viewport se afastou significativamente do centro da busca
 * atual (metade do raio, mínimo 2 km) — critério de exibição do botão. */
export function isSignificantPan(viewport: { lat: number; lng: number } | null): boolean {
  if (!viewport) return false;
  const currentSearch = useLeadsStore.getState().currentSearch;
  if (!currentSearch) return false;
  const drift = distanceKm(viewport, {
    lat: currentSearch.latitude,
    lng: currentSearch.longitude,
  });
  return drift > Math.max(2, currentSearch.radiusKm * 0.5);
}
