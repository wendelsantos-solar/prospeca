import type { Search, PresenceFilter } from "@/types";
import type { SearchDraft } from "@/stores";
import { distanceKm } from "@/lib/geo";

export type DirtyReason = "none" | "niche" | "location" | "radius-up" | "presence-wider";

// Coordinates closer than this are treated as the same center (rounding noise).
const SAME_CENTER_KM = 0.05;

// A presence change is client-satisfiable only when the new result set is a
// subset of the committed one. The only widening-safe case: current "all"
// (has every business) narrowed to a specific kind.
function presenceIsSubset(current: PresenceFilter, next: PresenceFilter): boolean {
  if (current === next) return true;
  return current === "all"; // all ⊇ {no-website, with-website}
}

export function classifyDirty(
  draft: SearchDraft,
  current: Search | null,
): { dirty: boolean; reason: DirtyReason; clientOnly: boolean } {
  if (!current) return { dirty: false, reason: "none", clientOnly: false };

  if (draft.niche.trim() !== current.niche.trim())
    return { dirty: true, reason: "niche", clientOnly: false };

  const moved =
    distanceKm(draft.coords, { lat: current.latitude, lng: current.longitude }) > SAME_CENTER_KM;
  if (moved || draft.location.trim() !== current.location.trim())
    return { dirty: true, reason: "location", clientOnly: false };

  if (draft.radiusKm > current.radiusKm)
    return { dirty: true, reason: "radius-up", clientOnly: false };

  if (draft.presence !== current.presence) {
    if (presenceIsSubset(current.presence, draft.presence))
      return { dirty: false, reason: "none", clientOnly: true };
    return { dirty: true, reason: "presence-wider", clientOnly: false };
  }

  // Only remaining diff is radius↓ → client-satisfiable.
  const clientOnly = draft.radiusKm < current.radiusKm;
  return { dirty: false, reason: "none", clientOnly };
}
