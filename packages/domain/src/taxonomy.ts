// Business Taxonomy — maps a user's term to a commercial category, the Google
// Places types used to search it, and related CNAE codes when a business-registry
// source is available.
//
// The data lives in taxonomy-data.ts (NOT hardcoded in frontend components —
// spec #10). This module only holds the shape + resolution logic, which is pure
// and deterministic so the UI can always show "como o termo foi interpretado".

export interface BusinessTaxonomyEntry {
  id: string;
  /** Canonical pt-BR category name. */
  name: string;
  slug: string;
  /** User terms that resolve to this category. */
  aliases: string[];
  /** Google Places types used for the actual search. */
  placesTypes: string[];
  /**
   * CNAE subclasses. Populated from a business-registry source when available —
   * seed values are marked in taxonomy-data.ts and must NOT be treated as
   * authoritative until confirmed (spec #28: never invent data).
   */
  cnaeCodes: string[];
  /** Extra matching keywords (appear in business names, not the category itself). */
  keywords: string[];
  parentId?: string | null;
}

/** Accent/case-insensitive normalization shared with the cache slug helpers. */
export function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a user term to a taxonomy entry.
 * Priority: exact name/alias/keyword match → substring (bidirectional) match.
 * Returns null when nothing matches (callers may then pass the raw term through).
 */
export function resolveTaxonomy(
  term: string,
  entries: BusinessTaxonomyEntry[],
): BusinessTaxonomyEntry | null {
  const q = normalizeTerm(term);
  if (!q) return null;

  const labels = (e: BusinessTaxonomyEntry) =>
    [e.name, e.slug, ...e.aliases, ...e.keywords].map(normalizeTerm);

  for (const e of entries) {
    if (labels(e).some((l) => l === q)) return e;
  }

  let best: BusinessTaxonomyEntry | null = null;
  for (const e of entries) {
    for (const l of labels(e)) {
      if (l && (l.includes(q) || q.includes(l))) {
        if (!best) best = e;
        break;
      }
    }
  }
  return best;
}
