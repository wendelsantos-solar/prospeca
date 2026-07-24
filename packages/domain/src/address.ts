// Duplicated at supabase/functions/_shared/address.ts (Deno can't import this
// package) — edit both. These tests are the shared contract.
/**
 * Derives address parts (street, neighborhood, city, state) from what Google
 * actually gives us.
 *
 * The search path (`execute-search`) uses a minimal FieldMask and only stores
 * `formatted_address` — `address_components` shows up later, and only for
 * places refreshed through `refresh-place-details`. So structured components
 * win when present and the formatted string is parsed otherwise.
 *
 * pt-BR formatted addresses look like:
 *   "R. Osvaldo Aranha, 1664 - Buritis, Belo Horizonte - MG, 30575-100, Brazil"
 *   "Av. Paulista, 1000, São Paulo - SP, 01310-100, Brasil"   (no neighborhood)
 */
export interface AddressParts {
  /** Street + number, without neighborhood/city/state/postal code. */
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  /** UF (2 letters) when the source carries one. */
  state: string | null;
}

const EMPTY: AddressParts = { street: null, neighborhood: null, city: null, state: null };

/** Places API (New) component shape; the legacy Geocoding shape is also accepted. */
interface RawComponent {
  types?: string[];
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
}

const COUNTRY_SUFFIX = /,\s*(brazil|brasil)\s*$/i;
const POSTAL_CODE = /^\d{5}-?\d{3}$/;
const CITY_STATE = /^(.+?)\s+-\s+([A-Z]{2})$/;

function fromComponents(components: unknown): AddressParts {
  if (!Array.isArray(components)) return EMPTY;
  const list = components as RawComponent[];
  const pick = (...types: string[]): string | null => {
    for (const type of types) {
      const hit = list.find((c) => Array.isArray(c.types) && c.types.includes(type));
      const value = hit?.longText ?? hit?.long_name;
      if (value) return value;
    }
    return null;
  };
  const shortOf = (type: string): string | null => {
    const hit = list.find((c) => Array.isArray(c.types) && c.types.includes(type));
    return hit?.shortText ?? hit?.short_name ?? null;
  };

  const route = pick("route");
  const number = pick("street_number");
  return {
    street: route ? (number ? `${route}, ${number}` : route) : null,
    neighborhood: pick("sublocality_level_1", "sublocality", "neighborhood"),
    city: pick("locality", "administrative_area_level_2"),
    state: shortOf("administrative_area_level_1"),
  };
}

function fromFormatted(formatted: string): AddressParts {
  const parts = formatted
    .replace(COUNTRY_SUFFIX, "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !POSTAL_CODE.test(p));
  if (parts.length === 0) return EMPTY;

  // "Cidade - UF" is the anchor: everything before it is street/neighborhood.
  const cityIdx = parts.findIndex((p) => CITY_STATE.test(p));
  if (cityIdx === -1) {
    return { street: parts.join(", ") || null, neighborhood: null, city: null, state: null };
  }
  const [, city, state] = parts[cityIdx].match(CITY_STATE)!;

  const before = parts.slice(0, cityIdx);
  let neighborhood: string | null = null;
  if (before.length > 0) {
    const last = before[before.length - 1];
    const dash = last.indexOf(" - ");
    if (dash !== -1) {
      neighborhood = last.slice(dash + 3).trim() || null;
      before[before.length - 1] = last.slice(0, dash).trim();
    }
  }
  return {
    street: before.filter(Boolean).join(", ") || null,
    neighborhood,
    city,
    state,
  };
}

/**
 * Structured components win; the formatted string fills whatever they miss
 * (a place refreshed without a `route` component still has a usable street).
 */
export function parseAddress(
  formattedAddress: string | null | undefined,
  addressComponents?: unknown,
): AddressParts {
  const structured = fromComponents(addressComponents);
  const parsed = formattedAddress?.trim() ? fromFormatted(formattedAddress) : EMPTY;
  return {
    street: structured.street ?? parsed.street,
    neighborhood: structured.neighborhood ?? parsed.neighborhood,
    city: structured.city ?? parsed.city,
    state: structured.state ?? parsed.state,
  };
}
