// OpenStreetMap providers for Edge Functions (Deno-native, self-contained).
// Mirrors the unit-tested logic in packages/providers (Overpass + Nominatim).
// Kept dependency-free so it is loaded ONLY behind a feature flag via dynamic
// import — when the flag is off, this module never executes and the existing
// Google path is byte-for-byte unchanged.
//
// NOTE: not runtime-verified in this repo checkout (no Deno/Supabase runtime
// available here). Logic mirrors packages/providers which passes 38 unit tests.

import type { GooglePlace } from "./google.ts";

function env(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

/** Thrown when a provider call is aborted by our own timeout — distinct from a plain
 * HTTP/parse failure so callers can surface a "provider slow, try a smaller area"
 * message instead of a generic internal error. */
export class OsmTimeoutError extends Error {
  constructor(message = "OSM provider timed out") {
    super(message);
    this.name = "OsmTimeoutError";
  }
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new OsmTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Nominatim geocoding ─────────────────────────────────────────────────────
export async function osmGeocode(
  query: string,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  const base = env("GEOCODER_BASE_URL", "https://nominatim.openstreetmap.org");
  const ua = env("GEOCODER_USER_AGENT", "leads-platform/1.0");
  const timeout = Number(env("GEOCODER_TIMEOUT_MS", "10000"));
  const url = new URL("/search", base);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");

  const data = await fetchJson<Array<{ lat: string; lon: string; display_name: string }>>(
    url.toString(),
    { headers: { "User-Agent": ua, Accept: "application/json" } },
    timeout,
  );
  const first = data?.[0];
  if (!first) return null;
  return { label: first.display_name, latitude: Number(first.lat), longitude: Number(first.lon) };
}

export async function osmReverseGeocode(
  lat: number,
  lng: number,
): Promise<{ label: string; latitude: number; longitude: number } | null> {
  const base = env("GEOCODER_BASE_URL", "https://nominatim.openstreetmap.org");
  const ua = env("GEOCODER_USER_AGENT", "leads-platform/1.0");
  const timeout = Number(env("GEOCODER_TIMEOUT_MS", "10000"));
  const url = new URL("/reverse", base);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");

  const data = await fetchJson<{ display_name?: string; error?: string }>(
    url.toString(),
    { headers: { "User-Agent": ua, Accept: "application/json" } },
    timeout,
  );
  if (!data?.display_name || data.error) return null;
  return { label: data.display_name, latitude: lat, longitude: lng };
}

// ── Overpass business discovery ─────────────────────────────────────────────
const CATEGORY_SELECTORS: Record<string, string[]> = {
  barbe: ["shop=hairdresser"], // barbearia / barbeiro
  cabele: ["shop=hairdresser"], // cabeleireiro
  clinica: ["amenity=clinic", "amenity=doctors", "healthcare=clinic"],
  medic: ["amenity=doctors", "amenity=clinic"],
  dentist: ["amenity=dentist", "healthcare=dentist"],
  restaurant: ["amenity=restaurant"],
  lanchonete: ["amenity=fast_food"],
  padaria: ["shop=bakery"],
  bar: ["amenity=bar", "amenity=pub"],
  farmacia: ["amenity=pharmacy"],
  pharmac: ["amenity=pharmacy"],
  academia: ["leisure=fitness_centre", "leisure=sports_centre"],
  hotel: ["tourism=hotel"],
  loja: ['shop~"."'],
  salao: ["shop=hairdresser", "shop=beauty"],
  beleza: ["shop=beauty", "shop=hairdresser"],
  estetica: ["shop=beauty"],
  pet: ["shop=pet", "amenity=veterinary"],
  veterin: ["amenity=veterinary"],
  oficina: ["shop=car_repair"],
  escola: ["amenity=school"],
  advocacia: ["office=lawyer"],
  contabil: ["office=accountant"],
};

function normalizeCategory(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectorsFor(query: string): string[] {
  // Word-based match so "barbearia" doesn't match the "bar" keyword.
  const words = normalizeCategory(query).split(" ").filter(Boolean);
  const matched: string[] = [];
  for (const [kw, sels] of Object.entries(CATEGORY_SELECTORS)) {
    if (words.some((w) => w === kw || (kw.length >= 4 && w.startsWith(kw)))) matched.push(...sels);
  }
  if (matched.length) return [...new Set(matched)];
  // Unknown category → match by name substring (escaped). A tag-scoped name
  // union was tried but Overpass rejected/timed out on it; the coverage gap for
  // mis-tagged businesses is fundamentally OSM and needs the Google provider.
  const safe = query.replace(/["\\]/g, "");
  return [`name~"${safe}",i`];
}

export function buildOverpassQuery(input: {
  query: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): string {
  const around = `(around:${Math.round(input.radiusMeters)},${input.latitude},${input.longitude})`;
  const parts = selectorsFor(input.query)
    .flatMap((sel) => [`node[${sel}]${around};`, `way[${sel}]${around};`])
    .join("\n  ");
  return `[out:json][timeout:25];\n(\n  ${parts}\n);\nout center tags;`;
}

interface OverpassEl {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Maps one Overpass element to a Google-Place-shaped object. null if unusable. */
export function mapElementToPlace(el: OverpassEl): GooglePlace | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;
  const category =
    t.amenity || t.shop || t.healthcare || t.office || t.leisure || t.tourism || null;
  const address = [
    [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", "),
    t["addr:city"] || t["addr:suburb"] || "",
  ]
    .filter(Boolean)
    .join(" - ");
  return {
    id: `${el.type}/${el.id}`,
    displayName: { text: name },
    formattedAddress: address || undefined,
    location: { latitude: lat, longitude: lon },
    primaryType: category ?? undefined,
    types: category ? [category] : [],
    websiteUri: t.website || t["contact:website"] || undefined,
    nationalPhoneNumber: t.phone || t["contact:phone"] || undefined,
  };
}

/** Returns Google-Place-shaped objects so execute-search's loop is unchanged. */
export async function osmSearchBusinesses(input: {
  query: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxResults?: number;
}): Promise<{ places: GooglePlace[] }> {
  const base = env("OVERPASS_BASE_URL", "https://overpass-api.de/api/interpreter");
  const ua = env("OVERPASS_USER_AGENT", "leads-platform/1.0");
  const timeout = Number(env("OVERPASS_TIMEOUT_MS", "30000"));
  const ql = buildOverpassQuery(input);

  const data = await fetchJson<{ elements?: OverpassEl[] }>(
    base,
    {
      method: "POST",
      body: `data=${encodeURIComponent(ql)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
        Accept: "application/json",
      },
    },
    timeout,
  );

  const seen = new Set<string>();
  const places: GooglePlace[] = [];
  for (const el of data.elements ?? []) {
    const place = mapElementToPlace(el);
    if (!place) continue;
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
    if (input.maxResults && places.length >= input.maxResults) break;
  }
  return { places };
}

/** "node/42" -> element-by-id Overpass query. null if not an OSM id. */
export function buildOverpassElementQuery(providerPlaceId: string, timeoutSec = 25): string | null {
  const m = /^(node|way|relation)\/(\d+)$/.exec(providerPlaceId.trim());
  if (!m) return null;
  const [, type, id] = m;
  return `[out:json][timeout:${timeoutSec}];\n${type}(${id});\nout center tags;`;
}

/**
 * Place details via Overpass (element by id). Returns a Google-Place-shaped
 * object so refresh-place-details' update block is unchanged. Fields OSM lacks
 * (rating, userRatingCount, regularOpeningHours, businessStatus,
 * addressComponents) are left undefined -> persisted as null. Never invented.
 */
export async function osmPlaceDetails(providerPlaceId: string): Promise<GooglePlace | null> {
  const ql = buildOverpassElementQuery(providerPlaceId);
  if (!ql) return null;
  const base = env("OVERPASS_BASE_URL", "https://overpass-api.de/api/interpreter");
  const ua = env("OVERPASS_USER_AGENT", "leads-platform/1.0");
  const timeout = Number(env("OVERPASS_TIMEOUT_MS", "30000"));
  const data = await fetchJson<{ elements?: OverpassEl[] }>(
    base,
    {
      method: "POST",
      body: `data=${encodeURIComponent(ql)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
        Accept: "application/json",
      },
    },
    timeout,
  );
  const el = data.elements?.[0];
  return el ? mapElementToPlace(el) : null;
}
