// taxonomy: resolve a user search term to a canonical business category +
// Google Places types, server-side (GAP #5).
//
// Priority: `business_taxonomies` table (migration 20260813000003) is the
// runtime source; when it is empty/unavailable the domain seed
// (packages/domain/src/taxonomy-data.ts) is the fallback — both share the same
// shape and both go through the same pure resolveTaxonomy. The DB id (uuid) is
// kept separate from the domain entry id (slug) so create-search can persist
// the FK without coupling the pure domain to Postgres.

import type { BusinessTaxonomyEntry } from "@leads/domain/taxonomy";
import { resolveTaxonomy } from "@leads/domain/taxonomy";
import { SEED_TAXONOMY } from "@leads/domain/taxonomy-data";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface SearchTaxonomyResolution {
  /** Canonical pt-BR category name (entry.name), or null when unresolved. */
  canonicalCategory: string | null;
  /** Google Places types for refining the search (includedType + post-filter). */
  placesTypes: string[];
  /** business_taxonomies.id when resolved against the DB (null for seed). */
  taxonomyId: string | null;
  resolved: boolean;
  source: "db" | "seed" | null;
}

const UNRESOLVED: SearchTaxonomyResolution = {
  canonicalCategory: null,
  placesTypes: [],
  taxonomyId: null,
  resolved: false,
  source: null,
};

interface TaxonomyRow {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  places_types: string[];
  keywords: string[];
  cnae_codes: string[];
}

/** Load taxonomy entries: DB first, domain seed as fallback. */
export async function resolveSearchTaxonomy(
  client: SupabaseClient,
  term: string | null | undefined,
): Promise<SearchTaxonomyResolution> {
  if (!term || !term.trim()) return UNRESOLVED;

  let rows: TaxonomyRow[] = [];
  try {
    const { data, error } = await client
      .from("business_taxonomies")
      .select("id, name, slug, aliases, places_types, keywords, cnae_codes");
    if (!error && data && data.length > 0) rows = data as unknown as TaxonomyRow[];
  } catch {
    rows = []; // fall through to seed
  }

  let source: "db" | "seed" = "seed";
  let pool: BusinessTaxonomyEntry[];
  let idBySlug = new Map<string, string>();

  if (rows.length > 0) {
    source = "db";
    pool = rows.map((r) => ({
      id: r.slug, // domain id is the slug; the uuid FK is tracked separately
      name: r.name,
      slug: r.slug,
      aliases: r.aliases ?? [],
      placesTypes: r.places_types ?? [],
      cnaeCodes: r.cnae_codes ?? [],
      keywords: r.keywords ?? [],
    }));
    idBySlug = new Map(rows.map((r) => [r.slug, r.id]));
  } else {
    pool = SEED_TAXONOMY;
  }

  const entry = resolveTaxonomy(term, pool);
  if (!entry) return UNRESOLVED;

  return {
    canonicalCategory: entry.name,
    placesTypes: entry.placesTypes,
    taxonomyId: source === "db" ? (idBySlug.get(entry.slug) ?? null) : null,
    resolved: true,
    source,
  };
}
