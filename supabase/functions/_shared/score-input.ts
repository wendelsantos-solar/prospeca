import type { ScoreInput } from "./score.ts";
import { normalizeBrazilianPhone, hasRealWebsite } from "./normalize.ts";
import type { GooglePlace } from "./google.ts";

/**
 * Extração única de sinais de score a partir de um place. Reusada no search-time
 * (execute-search) e no import (import-search-results) para garantir score
 * idêntico nos dois caminhos. Mirror de packages/domain/src/score-input.ts.
 */
export function scoreInputFromPlace(place: GooglePlace, distanceMeters: number | null): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : null;
  return {
    hasWebsite: hasRealWebsite(place.websiteUri ?? null),
    hasValidPhone: phone?.isValid ?? false,
    whatsappStatus: phone?.type === "mobile" ? "possible" : "unknown",
    hasEmail: false,
    hasInstagram: false,
    hasCategory: place.primaryType != null || (place.types?.length ?? 0) > 0,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    distanceMeters,
    businessStatus: place.businessStatus ?? null,
  };
}
