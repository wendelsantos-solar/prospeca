import type { Lead } from "@/types";
import { calculateScore, temperatureFromScore } from "@leads/domain";
import type { ScoreInput } from "@leads/domain";

export { calculateScore, temperatureFromScore };
export type { ScoreInput };

/** Maps a materialized Lead to the domain ScoreInput. A lead that already holds
 * a whatsapp value is treated as verified; distance is km→m. */
export function scoreInputFromLead(lead: Partial<Lead>): ScoreInput {
  return {
    hasWebsite: lead.hasWebsite ?? false,
    hasValidPhone: !!lead.phone,
    whatsappStatus: lead.whatsapp ? "verified" : "unknown",
    hasEmail: !!lead.email,
    hasInstagram: !!lead.instagram,
    hasCategory: !!lead.category,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    distanceMeters: lead.distanceKm != null ? Math.round(lead.distanceKm * 1000) : null,
    businessStatus: null,
  };
}
