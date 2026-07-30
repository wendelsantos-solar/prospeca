// Score-input extraction — inlined from @leads/domain/score-input so edge
// functions bundle without needing the monorepo import map.
import type { ScoreInput } from "./score.ts";
import { normalizePhone, hasRealWebsite } from "./normalize.ts";

export interface PlaceLike {
  websiteUri?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  primaryType?: string | null;
  types?: string[] | null;
  email?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
}

export interface PlaceRow {
  website_uri?: string | null;
  national_phone_number?: string | null;
  international_phone_number?: string | null;
  primary_type?: string | null;
  types?: string[] | null;
  email?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  rating?: number | null;
  user_rating_count?: number | null;
  business_status?: string | null;
}

export function scoreInputFromPlace(place: PlaceLike, distanceMeters: number | null): ScoreInput {
  const rawPhone = place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
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

export function scoreInputFromRow(row: PlaceRow, distanceMeters: number | null): ScoreInput {
  return scoreInputFromPlace(
    {
      websiteUri: row.website_uri ?? null,
      nationalPhoneNumber: row.national_phone_number ?? null,
      internationalPhoneNumber: row.international_phone_number ?? null,
      primaryType: row.primary_type ?? null,
      types: row.types ?? null,
      email: row.email ?? null,
      instagram: row.instagram ?? null,
      whatsapp: row.whatsapp ?? null,
      rating: row.rating ?? null,
      userRatingCount: row.user_rating_count ?? null,
      businessStatus: row.business_status ?? null,
    },
    distanceMeters,
  );
}
