import type { Lead } from "@/types";
import type { DiscoveryResult } from "@/repositories/types";

/**
 * Adapts a discovery result (a business found by a search, NOT yet a lead) into
 * a lead-shaped object so `LeadDetailsDrawer` can render it in read-only preview
 * mode. This object is NEVER persisted — it exists only for display while the
 * drawer is open with `readOnly = true`.
 *
 * Discovery carries less than a materialized lead: address, neighborhood, email,
 * instagram, whatsapp, notes/activities/timeline don't exist yet. Those degrade
 * to "" / undefined / [] here, and the drawer shows "—" for them in readOnly.
 * `stage`/`discoveredAt` are placeholders the readOnly branch never reads.
 */
export function discoveryToPreviewLead(r: DiscoveryResult): Lead {
  return {
    id: r.placeId,
    companyName: r.name,
    category: r.category ?? "",
    address: "",
    city: "",
    state: "",
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distanceKm,
    phone: r.phone ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    email: r.email ?? undefined,
    instagram: r.instagram ?? undefined,
    website: r.website ?? undefined,
    hasWebsite: r.hasWebsite,
    rating: r.rating ?? undefined,
    reviewCount: r.reviewCount ?? undefined,
    score: r.score,
    temperature: r.temperature,
    // Placeholder — readOnly preview never labels the stage (shows "não no funil").
    stage: "new",
    discoveredAt: "",
    notes: [],
    activities: [],
    timeline: [],
  };
}
