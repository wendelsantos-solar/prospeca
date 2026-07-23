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

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch com retry para blips transitórios do Google (429 / 408 / 5xx / erro de
 * rede) — backoff exponencial, respeitando Retry-After. Todas as chamadas são
 * idempotentes (buscas/geocode/detalhes são leituras), então re-tentar é seguro.
 * Falha persistente cai pro tratamento de status normal do chamador.
 */
async function fetchWithRetry(input: string | URL, init?: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(input, init);
      const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
      if (retryable && attempt < RETRY_ATTEMPTS - 1) {
        const ra = Number(res.headers.get("retry-after"));
        const delay = Number.isFinite(ra) && ra > 0 ? ra * 1000 : RETRY_BASE_MS * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new AppError("PROVIDER_UNAVAILABLE", "Falha de rede ao consultar o provedor.");
}

async function placesRequest(path: string, body: unknown, fieldMask: string) {
  const res = await fetchWithRetry(`${PLACES_BASE}${path}`, {
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

/**
 * Bounding box (retângulo) que circunscreve um círculo (centro + raio em metros).
 * Usado como `locationRestriction` do searchText — o Google só busca/preenche
 * dentro da caixa. O recorte fino para o círculo exato é feito por haversine no
 * chamador (execute-search).
 */
export function bboxFromCircle(lat: number, lng: number, radiusMeters: number) {
  const r = Math.min(radiusMeters, 50000);
  const dLat = r / 111_320; // metros por grau de latitude
  const dLng = r / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    low: { latitude: lat - dLat, longitude: lng - dLng },
    high: { latitude: lat + dLat, longitude: lng + dLng },
  };
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
    // locationRestriction (retângulo) faz o raio ser autoridade real: o Google
    // restringe E preenche dentro da caixa, em vez do bias frouxo do circle.
    locationRestriction: {
      rectangle: bboxFromCircle(input.latitude, input.longitude, input.radiusMeters),
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
  const res = await fetchWithRetry(`${PLACES_BASE}/places/${encodeURIComponent(providerPlaceId)}`, {
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
  const res = await fetchWithRetry(url);
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
  const res = await fetchWithRetry(url);
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
