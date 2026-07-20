// Provider contracts — the seam that decouples business logic from any specific
// data source (Google, Overpass, Nominatim, CSV, partner DBs...).
// The rest of the system depends on these interfaces, never on a vendor SDK.

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  provider: string;
}

export interface GeocodingProvider {
  readonly name: string;
  geocode(input: { query: string; countryCode?: string }): Promise<GeocodeResult | null>;
  reverse?(input: { latitude: number; longitude: number }): Promise<GeocodeResult | null>;
}

/** Source-agnostic business record. Every places provider normalizes to this. */
export type BusinessCandidate = {
  externalId: string;
  source: string;
  name: string;
  category: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  raw?: unknown;
};

export interface PlacesProvider {
  readonly name: string;
  searchBusinesses(input: {
    query: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<BusinessCandidate[]>;
}

export type EnrichmentField =
  | "website"
  | "phone"
  | "whatsapp"
  | "email"
  | "instagram"
  | "address";

export type VerificationStatus = "unverified" | "verified" | "not_found";

export interface EnrichedField {
  field: EnrichmentField;
  value: string;
  confidence: number; // 0..1
  sourceUrl: string | null;
  verification: VerificationStatus;
}

export interface LeadEnricher {
  readonly name: string;
  enrich(input: {
    leadId: string;
    name: string;
    website?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
  }): Promise<{ fields: EnrichedField[] }>;
}
