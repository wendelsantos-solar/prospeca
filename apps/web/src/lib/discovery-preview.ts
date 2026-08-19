import type { DisplayLead } from "@/types";
import type { DiscoveryResult } from "@/repositories/types";

/**
 * Adapts a discovery result (a business found by a search, NOT yet a lead) into
 * a lead-shaped object so `LeadDetailsDrawer` can render it in read-only preview
 * mode. This object is NEVER persisted — it exists only for display while the
 * drawer is open with `readOnly = true`.
 *
 * Discovery carries less than a materialized lead: notes/activities/timeline
 * don't exist yet and degrade to [] here. Address/city come from the Google
 * place (`get_search_discovery` returns them, parsed in the repository), so the
 * preview shows the same location the map pin does.
 * `stage`/`discoveredAt` are placeholders the readOnly branch never reads.
 *
 * Coordenada e distância passam INTACTAS, inclusive NULL: por isso o retorno é
 * `DisplayLead` e não `Lead`. Antes, o tipo obrigava um número aqui e o NULL
 * teria que virar 0 — a mentira que o LOTE 3 existe para remover.
 */
export function discoveryToPreviewLead(r: DiscoveryResult): DisplayLead {
  return {
    id: r.placeId,
    placeId: r.placeId,
    companyName: r.name,
    category: r.category ?? "",
    address: r.address ?? "",
    neighborhood: r.neighborhood ?? undefined,
    city: r.city ?? "",
    state: r.state ?? "",
    latitude: r.latitude,
    longitude: r.longitude,
    distanceKm: r.distanceKm,
    phone: r.phone ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    email: r.email ?? undefined,
    instagram: r.instagram ?? undefined,
    website: r.website ?? undefined,
    hasWebsite: r.hasWebsite,
    enrichmentState: r.enrichmentState,
    enrichmentFields: r.enrichmentFields,
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
