import type { ScoreInput } from "./score";
import { normalizePhone, hasRealWebsite } from "./normalize";

export interface PlaceLike {
  websiteUri?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
}

/**
 * Extração única de sinais de score a partir de um place. Reusada no search-time
 * (execute-search) e no import (import-search-results) para garantir score
 * idêntico nos dois caminhos.
 */
export function scoreInputFromPlace(place: PlaceLike, distanceMeters: number | null): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  return {
    hasWebsite: hasRealWebsite(place.websiteUri ?? null),
    hasValidPhone: phone?.isValid ?? false,
    whatsappStatus: phone?.type === "mobile" ? "possible" : "unknown",
    hasEmail: false,
    hasInstagram: false,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    distanceMeters,
    businessStatus: place.businessStatus ?? null,
  };
}
