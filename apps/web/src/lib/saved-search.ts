import type { SavedSearch, Search } from "@/types";

/** Adapt a persisted saved search into the `Search` shape the discovery
 * workspace uses, so reopening it shows the original results (no re-run). */
export function savedSearchToSearch(s: SavedSearch): Search {
  return {
    id: s.searchId,
    niche: s.query,
    location: s.locationLabel,
    latitude: s.latitude,
    longitude: s.longitude,
    radiusKm: s.radiusMeters / 1000,
    presence:
      s.presenceFilter === "without_website"
        ? "no-website"
        : s.presenceFilter === "with_website"
          ? "with-website"
          : "all",
    createdAt: s.createdAt,
    totalFound: s.foundCount,
    enrichedCount: s.foundCount,
    addedToPipeline: s.importedCount,
    contactsFound: s.foundCount,
  };
}
