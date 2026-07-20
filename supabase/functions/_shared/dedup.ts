// Deno-native deduplication for Edge Functions. Mirrors packages/domain/dedup.ts
// (multi-signal, idempotent, never merges on name alone), which passes unit
// tests. Kept self-contained (Deno import maps not configured for @leads/*).
//
// NOTE: not runtime-verified in this checkout (no Deno available); logic is a
// straight port of the unit-tested package.
import { normalizeCompanyName, normalizeDomain, normalizeBrazilianPhone } from "./normalize.ts";

export interface DedupRecord {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  externalId?: string | null;
  source?: string | null;
}

export const MERGE_THRESHOLD = 0.7;
export const REVIEW_THRESHOLD = 0.4;

function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

export function matchConfidence(
  a: DedupRecord,
  b: DedupRecord,
): { confidence: number; merge: boolean; review: boolean } {
  if (a.externalId && b.externalId && a.source === b.source && a.externalId === b.externalId) {
    return { confidence: 1, merge: true, review: false };
  }
  let score = 0;
  const domA = normalizeDomain(a.website);
  const domB = normalizeDomain(b.website);
  if (domA && domB && domA === domB) score += 0.5;

  const phA = a.phone ? normalizeBrazilianPhone(a.phone) : null;
  const phB = b.phone ? normalizeBrazilianPhone(b.phone) : null;
  if (phA?.isValid && phB?.isValid && phA.e164 === phB.e164) score += 0.4;

  score += nameSimilarity(a.name, b.name) * 0.3;

  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const d = haversineMeters([a.latitude, a.longitude], [b.latitude, b.longitude]);
    if (d <= 150) score += 0.2;
    else if (d <= 500) score += 0.1;
  }
  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) score += 0.05;

  const confidence = Math.min(1, Number(score.toFixed(3)));
  return {
    confidence,
    merge: confidence >= MERGE_THRESHOLD,
    review: confidence >= REVIEW_THRESHOLD && confidence < MERGE_THRESHOLD,
  };
}

/** Returns the deduplicated (canonical-only) subset, order-stable + idempotent. */
export function dedupeRecords<T extends DedupRecord>(records: T[]): T[] {
  const canon: T[] = [];
  for (const rec of records) {
    if (!canon.some((c) => matchConfidence(c, rec).merge)) canon.push(rec);
  }
  return canon;
}
