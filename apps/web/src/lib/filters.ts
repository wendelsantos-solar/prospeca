import type { Lead, LeadFilters } from "@/types";
import type { SortValue } from "@/lib/constants";

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
