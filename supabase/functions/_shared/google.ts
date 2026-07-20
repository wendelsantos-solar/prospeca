import { AppError } from "./http.ts";

// Google Places API (New) client. Server key only — never shipped to browser.
const PLACES_BASE = "https://places.googleapis.com/v1";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

// Minimal FieldMask: list + dedupe fields only. No photos/reviews (expensive SKUs).
export const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.googleMapsUri",
  "nextPageToken",
].join(",");

export const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "businessStatus",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "addressComponents",
].join(",");

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  regularOpeningHours?: unknown;
  addressComponents?: unknown;
}

function serverKey(): string {
  const key = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
  if (!key) throw new AppError("PROVIDER_UNAVAILABLE", "Google Places não configurado.");
  return key;
}

async function placesRequest(path: string, body: unknown, fieldMask: string) {
  const res = await fetch(`${PLACES_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": serverKey(),
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    throw new AppError("PROVIDER_QUOTA_EXCEEDED", "Quota do provedor excedida.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new AppError("PROVIDER_UNAVAILABLE", "Falha na consulta ao provedor.", {
      status: res.status,
      body: text.slice(0, 500),
    });
  }
  return res.json();
}

export async function textSearch(input: {
  textQuery: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  pageToken?: string;
  pageSize?: number;
}): Promise<{ places: GooglePlace[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery: input.textQuery,
    pageSize: Math.min(input.pageSize ?? 20, 20),
    locationBias: {
      circle: {
        center: { latitude: input.latitude, longitude: input.longitude },
        radius: Math.min(input.radiusMeters, 50000),
      },
    },
    languageCode: "pt-BR",
    regionCode: "BR",
  };
  if (input.pageToken) body.pageToken = input.pageToken;
  const data = await placesRequest("/places:searchText", body, SEARCH_FIELD_MASK);
  return { places: data.places ?? [], nextPageToken: data.nextPageToken };
}

export async function nearbySearch(input: {
  includedTypes: string[];
  latitude: number;
  longitude: number;
  radiusMeters: number;
  pageSize?: number;
}): Promise<{ places: GooglePlace[] }> {
  const body = {
    includedTypes: input.includedTypes,
    maxResultCount: Math.min(input.pageSize ?? 20, 20),
    locationRestriction: {
      circle: {
        center: { latitude: input.latitude, longitude: input.longitude },
        radius: Math.min(input.radiusMeters, 50000),
      },
    },
    languageCode: "pt-BR",
    regionCode: "BR",
  };
  const data = await placesRequest("/places:searchNearby", body, SEARCH_FIELD_MASK);
  return { places: data.places ?? [] };
}

export async function placeDetails(providerPlaceId: string): Promise<GooglePlace> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(providerPlaceId)}`, {
    headers: {
      "X-Goog-Api-Key": serverKey(),
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });
  if (!res.ok) {
    throw new AppError("PROVIDER_UNAVAILABLE", "Falha ao consultar detalhes.", {
      status: res.status,
    });
  }
  return res.json();
}

export async function geocode(query: string): Promise<{
  label: string;
  latitude: number;
  longitude: number;
} | null> {
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set("address", query);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", serverKey());
  const res = await fetch(url);
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", "Falha na geocodificação.");
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return {
    label: first.formatted_address,
    latitude: first.geometry.location.lat,
    longitude: first.geometry.location.lng,
  };
}

type AddressComponent = { long_name: string; short_name: string; types: string[] };

/** Monta "Bairro, Cidade" a partir dos address_components do Geocoding. */
export function buildReverseLabel(
  components: AddressComponent[],
  formattedAddress: string,
): string {
  const pick = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name;

  const neighborhood = pick("sublocality_level_1", "sublocality", "neighborhood");
  const city = pick("administrative_area_level_2", "locality");
  const state = pick("administrative_area_level_1");

  if (neighborhood && city) return `${neighborhood}, ${city}`;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return formattedAddress;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", serverKey());
  const res = await fetch(url);
  if (!res.ok) throw new AppError("PROVIDER_UNAVAILABLE", "Falha na geocodificação reversa.");
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return {
    label: buildReverseLabel(first.address_components ?? [], first.formatted_address ?? ""),
    latitude: lat,
    longitude: lng,
  };
}
