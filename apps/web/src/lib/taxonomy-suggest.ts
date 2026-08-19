import { normalizeTerm, SEED_TAXONOMY, type BusinessTaxonomyEntry } from "@leads/domain";

export const MAX_TAXONOMY_SUGGESTIONS = 6;

/**
 * Live taxonomy suggestions for the mission input (V3-A autocomplete).
 * Matches name + aliases (accent/case-insensitive via normalizeTerm), limited
 * to MAX_TAXONOMY_SUGGESTIONS. Pure and honest: suggestions come ONLY from the
 * taxonomy seed — never a universe estimate (no real source exists for that
 * number; we don't fabricate one).
 */
export function suggestTaxonomy(text: string): BusinessTaxonomyEntry[] {
  const q = normalizeTerm(text.trim());
  if (q.length < 2) return [];
  return SEED_TAXONOMY.filter((t) => {
    const haystack = [t.name, ...t.aliases].map((a) => normalizeTerm(a));
    return haystack.some((h) => h.includes(q));
  }).slice(0, MAX_TAXONOMY_SUGGESTIONS);
}

/** First CNAE code of a taxonomy entry, or null when the seed has none. */
export function taxonomyCnaeHint(entry: BusinessTaxonomyEntry): string | null {
  const codes = entry.cnaeCodes.filter(Boolean);
  return codes.length > 0 ? codes[0] : null;
}
