import type { ScoreInput } from "./score.ts";
import { normalizeBrazilianPhone, hasRealWebsite } from "./normalize.ts";
import type { GooglePlace } from "./google.ts";

/**
 * Extração única de sinais de score a partir de um place. Reusada no search-time
 * (execute-search) e no import (import-search-results) para garantir score
 * idêntico nos dois caminhos. Mirror de packages/domain/src/score-input.ts.
 */
// Enrichment fields (email/instagram/whatsapp) live on the places row, filled by
// enrich-discovery. A freshly-mapped search-time place lacks them (→ absent).
type PlaceWithEnrichment = GooglePlace & {
  email?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
};

export function scoreInputFromPlace(
  place: PlaceWithEnrichment,
  distanceMeters: number | null,
): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : null;
  const hasWhatsapp = place.whatsapp != null && place.whatsapp !== "";
  return {
    hasWebsite: hasRealWebsite(place.websiteUri ?? null),
    hasValidPhone: phone?.isValid ?? false,
    whatsappStatus: hasWhatsapp ? "verified" : phone?.type === "mobile" ? "possible" : "unknown",
    hasEmail: place.email != null && place.email !== "",
    hasInstagram: place.instagram != null && place.instagram !== "",
    hasCategory: place.primaryType != null || (place.types?.length ?? 0) > 0,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    distanceMeters,
    businessStatus: place.businessStatus ?? null,
  };
}
