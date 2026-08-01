// Provider contracts — interfaces that all provider implementations must satisfy.
// These live in @leads/contracts so both frontend (apps/web) and edge functions
// can import them without creating a dependency cycle.
import type { LatLng } from "@leads/geo";

// ── Geocoding ────────────────────────────────────────────────────────

/** Result from a geocoding lookup. */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  placeId?: string;
  /** Bounding box for the matched location, if the provider supports it. */
  bbox?: [number, number, number, number];
}

/** Reverse-geocode result (coordinates → human-readable address). */
export interface ReverseGeocodeResult {
  displayName: string;
  components: {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface GeocodingProvider {
  /** Forward geocode: address string → coordinates. */
  geocode(query: string): Promise<GeocodeResult | null>;
  /** Reverse geocode: coordinates → address. */
  reverse(latLng: LatLng): Promise<ReverseGeocodeResult | null>;
}

// ── Places Discovery ─────────────────────────────────────────────────

/**
 * A business found by a places provider. Provider-agnostic — Google, Overpass,
 * or any future source maps their output into this shape.
 */
export interface BusinessCandidate {
  /** Provider-specific unique ID. */
  externalId: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  types: string[];
  /** Formatted address as returned by the provider. */
  formattedAddress: string | null;
  /** Structured address components (when available). */
  addressComponents?: unknown;
  phone: string | null;
  /** International phone number (E.164) when available. */
  internationalPhone: string | null;
  website: string | null;
  /** Deep link to the provider's listing (Google Maps URI, OSM URL, etc.). */
  providerUrl: string | null;
  /** Provider's business status (OPERATIONAL, CLOSED, etc.). null when unknown. */
  businessStatus: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Raw provider payload for caching/replay. */
  rawPayload?: unknown;
}

export interface PlacesSearchParams {
  query: string;
  category?: string;
  center: LatLng;
  radiusMeters: number;
  maxResults: number;
  /** Language preference (BCP 47 tag, e.g. "pt-BR"). */
  language?: string;
}

export interface PlacesProvider {
  /** Provider identifier used in cache keys (e.g. "google", "overpass"). */
  readonly name: string;

  /** Search for businesses matching the query near the center point. */
  search(params: PlacesSearchParams): Promise<{
    candidates: BusinessCandidate[];
    /** Number of provider API calls consumed. */
    requestCount: number;
  }>;

  /** Refresh details for a single place. Optional — only Google supports this. */
  refreshDetails?(externalId: string): Promise<Partial<BusinessCandidate> | null>;
}

// ── Lead Enrichment ──────────────────────────────────────────────────

export type EnrichmentField = "website" | "phone" | "whatsapp" | "email" | "instagram" | "address";

export interface EnrichedField {
  field: EnrichmentField;
  value: string;
  confidence: number;
  verification: "unverified" | "verified" | "not_found";
  sourceUrl: string | null;
  provider: string;
}

export interface LeadEnricher {
  readonly name: string;

  /** Enrich a single lead's contact signals from its own website. */
  enrichFromWebsite(input: { website?: string | null; leadId: string }): Promise<{
    fields: EnrichedField[];
    status: "ok" | "not_found" | "blocked";
  }>;
}
