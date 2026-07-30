// Deduplication — inlined from @leads/domain/dedup so edge functions bundle
// without needing the monorepo import map.
import { haversineMeters, isValidLatLng } from "./geo.ts";
import { normalizeCompanyName, normalizeDomain, normalizePhone } from "./normalize.ts";

export interface DedupRecord {
  id: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  externalId?: string | null;
  source?: string | null;
}

export const MERGE_THRESHOLD = 0.7;
export const REVIEW_THRESHOLD = 0.4;

export interface MatchResult {
  confidence: number;
  merge: boolean;
  review: boolean;
  signals: string[];
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

export function matchConfidence(a: DedupRecord, b: DedupRecord): MatchResult {
  const signals: string[] = [];
  let score = 0;

  if (a.externalId && b.externalId && a.source === b.source && a.externalId === b.externalId) {
    signals.push("external_id");
    return { confidence: 1, merge: true, review: false, signals };
  }

  const domA = normalizeDomain(a.website);
  const domB = normalizeDomain(b.website);
  if (domA && domB && domA === domB) {
    score += 0.5;
    signals.push("domain");
  }

  const phA = a.phone ? normalizePhone(a.phone) : null;
  const phB = b.phone ? normalizePhone(b.phone) : null;
  if (phA?.isValid && phB?.isValid && phA.e164 === phB.e164) {
    score += 0.4;
    signals.push("phone");
  }

  const sim = nameSimilarity(a.name, b.name);
  if (sim > 0) {
    score += sim * 0.3;
    if (sim === 1) signals.push("name_exact");
    else if (sim >= 0.5) signals.push("name_partial");
  }

  if (
    a.latitude != null &&
    a.longitude != null &&
    b.latitude != null &&
    b.longitude != null &&
    isValidLatLng({ latitude: a.latitude, longitude: a.longitude }) &&
    isValidLatLng({ latitude: b.latitude, longitude: b.longitude })
  ) {
    const d = haversineMeters(
      { latitude: a.latitude, longitude: a.longitude },
      { latitude: b.latitude, longitude: b.longitude },
    );
    if (d <= 150) {
      score += 0.2;
      signals.push("geo_150m");
    } else if (d <= 500) {
      score += 0.1;
      signals.push("geo_500m");
    }
  }

  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
    score += 0.05;
    signals.push("city");
  }

  const confidence = Math.min(1, Number(score.toFixed(3)));
  return {
    confidence,
    merge: confidence >= MERGE_THRESHOLD,
    review: confidence >= REVIEW_THRESHOLD && confidence < MERGE_THRESHOLD,
    signals,
  };
}

export interface DedupCluster {
  canonicalId: string;
  memberIds: string[];
  reviewIds: string[];
}

export function dedupeCandidates(records: DedupRecord[]): DedupCluster[] {
  const clusters: DedupCluster[] = [];
  const canonicalRecord = new Map<string, DedupRecord>();

  for (const rec of records) {
    let placed = false;
    for (const cluster of clusters) {
      const canonical = canonicalRecord.get(cluster.canonicalId)!;
      const m = matchConfidence(canonical, rec);
      if (m.merge) {
        cluster.memberIds.push(rec.id);
        placed = true;
        break;
      }
      if (m.review && !cluster.reviewIds.includes(rec.id)) {
        cluster.reviewIds.push(rec.id);
      }
    }
    if (!placed) {
      clusters.push({ canonicalId: rec.id, memberIds: [rec.id], reviewIds: [] });
      canonicalRecord.set(rec.id, rec);
    }
  }
  return clusters;
}
