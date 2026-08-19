import type { Lead, LeadFilters } from "@/types";
import type { DiscoveryResult } from "@leads/contracts";
import { confidenceBandFromConfidence } from "@leads/domain";
import type { SortValue } from "@/lib/constants";
import { distanceKm, type LatLng } from "@/lib/geo";

// Google always carries rating/review data, so the rating chip is always shown.
export const QUICK_FILTERS = [
  { id: "whatsapp", label: "WhatsApp", predicate: (l: Lead) => !!l.whatsapp },
  { id: "phone", label: "Telefone", predicate: (l: Lead) => !!l.phone },
  { id: "instagram", label: "Instagram", predicate: (l: Lead) => !!l.instagram },
  { id: "email", label: "E-mail", predicate: (l: Lead) => !!l.email },
  { id: "no-site", label: "Sem site", predicate: (l: Lead) => !l.hasWebsite },
  { id: "with-site", label: "Com site", predicate: (l: Lead) => l.hasWebsite },
  { id: "rating-4", label: "Nota > 4", predicate: (l: Lead) => (l.rating ?? 0) > 4 },
  { id: "hot", label: "Quente", predicate: (l: Lead) => l.temperature === "hot" },
  { id: "warm", label: "Morno", predicate: (l: Lead) => l.temperature === "warm" },
  { id: "cold", label: "Frio", predicate: (l: Lead) => l.temperature === "cold" },
  { id: "uncontacted", label: "Não contatado", predicate: (l: Lead) => l.stage === "new" },
  { id: "has-value", label: "Com valor", predicate: (l: Lead) => (l.estimatedValue ?? 0) > 0 },
];

/** Hard filter: only items inside the live search radius are ever shown — map,
 * list, and counts must all agree, matching the reference product's behavior
 * (radius = what you get, not a dimmed preview of what you'd get). Generic over
 * anything with lat/lng (Lead or DiscoveryResult). */
export function filterByRadius<T extends { latitude: number; longitude: number }>(
  items: T[],
  center: LatLng,
  radiusKm: number,
): T[] {
  return items.filter((i) => distanceKm(center, { lat: i.latitude, lng: i.longitude }) <= radiusKm);
}

export function applyFilters(leads: Lead[], filters: LeadFilters): Lead[] {
  return leads.filter((l) => {
    for (const chip of filters.quick) {
      const f = QUICK_FILTERS.find((q) => q.id === chip);
      if (f && !f.predicate(l)) return false;
    }
    if (filters.minRating != null && (l.rating ?? 0) < filters.minRating) return false;
    if (filters.minReviews != null && (l.reviewCount ?? 0) < filters.minReviews) return false;
    if (filters.maxDistance != null && l.distanceKm > filters.maxDistance) return false;
    if (filters.minScore != null && l.score < filters.minScore) return false;
    if (filters.maxScore != null && l.score > filters.maxScore) return false;
    if (filters.hasPhone && !l.phone) return false;
    if (filters.hasWhatsapp && !l.whatsapp) return false;
    if (filters.hasInstagram && !l.instagram) return false;
    if (filters.hasEmail && !l.email) return false;
    if (filters.hasWebsite === true && !l.hasWebsite) return false;
    if (filters.hasWebsite === false && l.hasWebsite) return false;
    if (filters.temperatures?.length && !filters.temperatures.includes(l.temperature)) return false;
    if (filters.stages?.length && !filters.stages.includes(l.stage)) return false;
    if (filters.categories?.length && !filters.categories.includes(l.category)) return false;
    if (filters.cities?.length && !filters.cities.includes(l.city)) return false;
    if (
      filters.neighborhoods?.length &&
      (!l.neighborhood || !filters.neighborhoods.includes(l.neighborhood))
    )
      return false;
    if (filters.valueMin != null && (l.estimatedValue ?? 0) < filters.valueMin) return false;
    if (filters.valueMax != null && (l.estimatedValue ?? 0) > filters.valueMax) return false;
    if (
      filters.discoveredAfter &&
      new Date(l.discoveredAt) < new Date(`${filters.discoveredAfter}T00:00:00`)
    )
      return false;
    if (
      filters.lastInteractionAfter &&
      (!l.lastInteractionAt ||
        new Date(l.lastInteractionAt) < new Date(`${filters.lastInteractionAfter}T00:00:00`))
    )
      return false;
    if (filters.onlyUncontacted && l.stage !== "new") return false;
    if (filters.onlyWithTask && !l.nextActivity) return false;
    return true;
  });
}

export function sortLeads(leads: Lead[], sort: SortValue): Lead[] {
  const arr = [...leads];
  switch (sort) {
    case "score-desc":
      return arr.sort((a, b) => b.score - a.score);
    case "rating-desc":
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "reviews-desc":
      return arr.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case "distance-asc":
      return arr.sort((a, b) => a.distanceKm - b.distanceKm);
    case "recent":
      return arr.sort((a, b) => +new Date(b.discoveredAt) - +new Date(a.discoveredAt));
    case "name-asc":
      return arr.sort((a, b) => a.companyName.localeCompare(b.companyName));
    case "name-desc":
      return arr.sort((a, b) => b.companyName.localeCompare(a.companyName));
    case "value-desc":
      return arr.sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0));
    case "relevance":
    default:
      return arr.sort(
        (a, b) =>
          b.score +
          (b.temperature === "hot" ? 10 : 0) -
          (a.score + (a.temperature === "hot" ? 10 : 0)),
      );
  }
}

// ── Advanced discovery filters (V3-A — progressive disclosure) ─────────────
//
// Filters over data ALREADY present on DiscoveryResult — no new backend calls,
// no fabricated values. Every predicate is honest: absent data simply does not
// match an "is present" filter and never matches a fabricated value.

export interface AdvancedDiscoveryFilters {
  /** Segment (Google primary category), case-insensitive contains. */
  segment?: string;
  neighborhood?: string;
  city?: string;
  /** LOW/MEDIUM/HIGH band of the persisted V2 confidence, or "unknown". */
  confidenceBand?: "low" | "medium" | "high" | "unknown";
  /** Overall enrichment lifecycle. */
  enrichmentStatus?: "pending" | "processing" | "enriched" | "partial" | "failed";
  /** Presence of specific contact signals. */
  signal?: "no_website" | "has_whatsapp" | "has_phone" | "has_email" | "has_website";
  /** Atividade econômica (CNAE). Casa por DESCRIÇÃO legível (contains,
   * case-insensitive) ou por CÓDIGO (prefixo) — o usuário digita "barbearia",
   * não "9602-5/01". Resultados sem CNPJ consultado (primaryCnae null) ficam
   * FORA quando o filtro está ativo: ausência de consulta não é evidência de
   * atividade diferente, mas o usuário pediu um recorte específico. */
  cnae?: string;
  /** Filtros rápidos (F3) — ids de DISCOVERY_QUICK_FILTERS. Client-side. */
  quick?: string[];
  /** Presença digital LOCAL (F3): sem instagram E sem whatsapp. Filtra os
   * resultados já carregados — nunca é parâmetro de busca. */
  noNetworks?: boolean;
  /** Presença digital LOCAL: exatamente UM dos dois canais sociais mapeados
   * (instagram/whatsapp) — presença parcial/fraca. */
  weakNetworks?: boolean;
  /** Presença digital LOCAL: zero avaliações persistidas. */
  noReviews?: boolean;
  /**
   * Decisor identificado (People Intelligence). Filtra os resultados já
   * carregados.
   *
   * `any` = tem pelo menos um decisor sustentável; `high` = tem um de banda
   * alta (sócio/administrador/diretor). Empresa sem CNPJ consultado tem
   * contagem 0 e fica FORA quando o filtro está ativo — ausência de consulta
   * não é evidência de que não há decisor, mas o usuário pediu o recorte de
   * quem JÁ tem um nome para procurar.
   */
  decisionMaker?: "any" | "high";
}

/** Filtros rápidos aplicáveis a resultados de descoberta — os mesmos ids dos
 * QUICK_FILTERS de CRM, com predicados sobre campos que DiscoveryResult DE FATO
 * carrega (stage/valor estimado são lead-only e ficam de fora). */
export const DISCOVERY_QUICK_FILTERS = [
  { id: "whatsapp", label: "WhatsApp", predicate: (r: DiscoveryResult) => !!r.whatsapp },
  { id: "phone", label: "Telefone", predicate: (r: DiscoveryResult) => !!r.phone },
  { id: "instagram", label: "Instagram", predicate: (r: DiscoveryResult) => !!r.instagram },
  { id: "email", label: "E-mail", predicate: (r: DiscoveryResult) => !!r.email },
  { id: "no-site", label: "Sem site", predicate: (r: DiscoveryResult) => !r.hasWebsite },
  { id: "rating-4", label: "Nota > 4", predicate: (r: DiscoveryResult) => (r.rating ?? 0) > 4 },
  { id: "hot", label: "Quente", predicate: (r: DiscoveryResult) => r.temperature === "hot" },
  {
    id: "decision-maker",
    label: "Com decisor",
    predicate: (r: DiscoveryResult) => r.decisionMakerCount > 0,
  },
] as const;

export const EMPTY_ADVANCED_FILTERS: AdvancedDiscoveryFilters = {};

function isEmpty(v: unknown): boolean {
  return v == null || v === "" || v === false || (Array.isArray(v) && v.length === 0);
}

/** True when any advanced filter is active. */
export function hasAdvancedFilters(f: AdvancedDiscoveryFilters): boolean {
  return Object.values(f).some((v) => !isEmpty(v));
}

/** Quantos filtros avançados/locais estão ativos (badge numérico do botão). */
export function countActiveAdvancedFilters(f: AdvancedDiscoveryFilters): number {
  return Object.values(f).filter((v) => !isEmpty(v)).length;
}

function matchesSegment(r: DiscoveryResult, segment: string): boolean {
  const q = segment.trim().toLowerCase();
  if (!q) return true;
  return (r.category ?? "").toLowerCase().includes(q);
}

function matchesText(value: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (value ?? "").toLowerCase().includes(q);
}

export function applyAdvancedDiscoveryFilters(
  results: DiscoveryResult[],
  filters: AdvancedDiscoveryFilters,
): DiscoveryResult[] {
  if (!hasAdvancedFilters(filters)) return results;
  return results.filter((r) => {
    if (filters.segment && !matchesSegment(r, filters.segment)) return false;
    if (filters.neighborhood && !matchesText(r.neighborhood, filters.neighborhood)) return false;
    if (filters.city && !matchesText(r.city, filters.city)) return false;
    if (filters.confidenceBand) {
      // A band filter is EXCLUSIVE: each band is its own set and results
      // WITHOUT a persisted confidence are the separate "unknown" band
      // (spec V3 — HIGH/MEDIUM/LOW + UNKNOWN). Filtering by a band never
      // mixes unknowns in, and filtering by "unknown" only matches them.
      if (filters.confidenceBand === "unknown") {
        if (r.opportunityConfidence != null) return false;
      } else {
        if (
          r.opportunityConfidence == null ||
          confidenceBandFromConfidence(r.opportunityConfidence) !== filters.confidenceBand
        ) {
          return false;
        }
      }
    }
    if (filters.enrichmentStatus && (r.enrichmentState ?? "pending") !== filters.enrichmentStatus) {
      return false;
    }
    if (filters.decisionMaker === "any" && r.decisionMakerCount < 1) return false;
    if (filters.decisionMaker === "high" && r.topDecisionMakerBand !== "high") return false;
    if (filters.cnae) {
      const q = filters.cnae.trim().toLowerCase();
      const byCode = (r.primaryCnae ?? "").toLowerCase().startsWith(q);
      const byDesc = (r.cnaeDescription ?? "").toLowerCase().includes(q);
      const bySecondary = (r.secondaryCnaes ?? []).some((c) => c.toLowerCase().startsWith(q));
      if (!byCode && !byDesc && !bySecondary) return false;
    }
    if (filters.signal === "no_website" && r.hasWebsite) return false;
    if (filters.signal === "has_website" && !r.hasWebsite) return false;
    if (filters.signal === "has_whatsapp" && !r.whatsapp) return false;
    if (filters.signal === "has_phone" && !r.phone) return false;
    if (filters.signal === "has_email" && !r.email) return false;
    // Filtros rápidos (F3) — ids de DISCOVERY_QUICK_FILTERS.
    if (filters.quick?.length) {
      for (const id of filters.quick) {
        const q = DISCOVERY_QUICK_FILTERS.find((f) => f.id === id);
        if (q && !q.predicate(r)) return false;
      }
    }
    // Presença digital local (F3) — sobre o resultado carregado, nunca
    // parâmetro de busca. Sem redes = zero canais sociais; fracas = um só.
    if (filters.noNetworks && (r.instagram || r.whatsapp)) return false;
    if (filters.weakNetworks && !!r.instagram === !!r.whatsapp) return false;
    if (filters.noReviews && (r.reviewCount ?? 0) > 0) return false;
    return true;
  });
}
