// OverpassPlacesProvider — OpenStreetMap business discovery via Overpass API.
// Implements PlacesProvider so the rest of the system never sees Overpass QL.
import type { BusinessCandidate, PlacesProvider } from "@leads/contracts";
import { normalizeCompanyName } from "@leads/domain";
import { requestJson, type HttpOptions } from "./http";

export interface OverpassConfig {
  baseUrl: string; // e.g. https://overpass-api.de/api/interpreter
  userAgent: string; // required by OSM usage policy
  timeoutMs?: number;
  maxRetries?: number;
  maxResults?: number;
  fetchImpl?: HttpOptions["fetchImpl"];
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Category keyword -> OSM tag selectors. Extend freely; unknown categories fall
// back to a case-insensitive name match, so discovery still works.
const CATEGORY_SELECTORS: Record<string, string[]> = {
  barbe: ["shop=hairdresser"], // barbearia / barbeiro
  cabele: ["shop=hairdresser"], // cabeleireiro
  clinica: ["amenity=clinic", "amenity=doctors", "healthcare=clinic"],
  medic: ["amenity=doctors", "amenity=clinic", 'healthcare~"."'],
  dentist: ["amenity=dentist", "healthcare=dentist"],
  restaurant: ["amenity=restaurant"],
  lanchonete: ["amenity=fast_food"],
  padaria: ["shop=bakery"],
  bar: ["amenity=bar", "amenity=pub"],
  farmacia: ["amenity=pharmacy"],
  pharmac: ["amenity=pharmacy"],
  academia: ["leisure=fitness_centre", "leisure=sports_centre"],
  gym: ["leisure=fitness_centre"],
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

function selectorsFor(query: string): string[] {
  // Word-based match so "barbearia" doesn't match the "bar" keyword.
  const words = normalizeCompanyName(query).split(" ").filter(Boolean);
  const matched: string[] = [];
  for (const [kw, sels] of Object.entries(CATEGORY_SELECTORS)) {
    if (words.some((w) => w === kw || (kw.length >= 4 && w.startsWith(kw)))) matched.push(...sels);
  }
  if (matched.length > 0) return [...new Set(matched)];
  // Fallback: match by name substring (escaped).
  const safe = query.replace(/["\\]/g, "");
  return [`name~"${safe}",i`];
}

export function buildOverpassQuery(input: {
  query: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  timeoutSec?: number;
}): string {
  const around = `(around:${Math.round(input.radiusMeters)},${input.latitude},${input.longitude})`;
  const parts = selectorsFor(input.query)
    .flatMap((sel) => [`node[${sel}]${around};`, `way[${sel}]${around};`])
    .join("\n  ");
  return `[out:json][timeout:${input.timeoutSec ?? 25}];\n(\n  ${parts}\n);\nout center tags;`;
}

function pickAddress(t: Record<string, string>): string | null {
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
  const city = t["addr:city"] || t["addr:suburb"] || "";
  const parts = [street, city, t["addr:state"]].filter(Boolean);
  return parts.length ? parts.join(" - ") : null;
}

function primaryCategory(t: Record<string, string>): string | null {
  return (
    t.amenity || t.shop || t.healthcare || t.office || t.leisure || t.tourism || t.craft || null
  );
}

export function mapElement(el: OverpassElement): BusinessCandidate | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;
  return {
    externalId: `${el.type}/${el.id}`,
    source: "overpass",
    name,
    category: primaryCategory(t),
    latitude: lat,
    longitude: lon,
    address: pickAddress(t),
    phone: t.phone || t["contact:phone"] || null,
    website: t.website || t["contact:website"] || null,
    raw: el,
  };
}

export class OverpassPlacesProvider implements PlacesProvider {
  readonly name = "overpass";
  constructor(private readonly config: OverpassConfig) {}

  async searchBusinesses(input: {
    query: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<BusinessCandidate[]> {
    const ql = buildOverpassQuery(input);
    const data = await requestJson<{ elements?: OverpassElement[] }>(
      {
        url: this.config.baseUrl,
        method: "POST",
        body: `data=${encodeURIComponent(ql)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
      {
        fetchImpl: this.config.fetchImpl,
        timeoutMs: this.config.timeoutMs ?? 30000,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      },
    );

    const seen = new Set<string>();
    const out: BusinessCandidate[] = [];
    for (const el of data.elements ?? []) {
      const candidate = mapElement(el);
      if (!candidate) continue;
      if (seen.has(candidate.externalId)) continue;
      seen.add(candidate.externalId);
      out.push(candidate);
      if (this.config.maxResults && out.length >= this.config.maxResults) break;
    }
    return out;
  }
}
