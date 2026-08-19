// Territory Intelligence — aggregate companies into geographic territories and
// surface comparative insights (spec #37, #40, #41). Pure and deterministic:
// the UI and (future) territory jobs both consume these functions, so a region
// means the same thing everywhere.

export interface TerritoryCompany {
  id: string;
  neighborhood?: string | null;
  city?: string | null;
  score: number; // 0..100
  temperature: "hot" | "warm" | "cold";
  hasWebsite: boolean;
}

export type TerritoryGroupBy = "neighborhood" | "city";

export interface TerritoryStats {
  key: string;
  companyCount: number;
  hotCount: number;
  avgScore: number;
  withoutWebsite: number;
  /** 0..1 — share of companies without a website. */
  withoutWebsiteRatio: number;
}

/** Minimum companies per territory before it is considered a real sample. */
export const MIN_TERRITORY_SAMPLE = 3;
/** Minimum territories before comparative insights are safe to emit. */
export const MIN_TERRITORIES_FOR_INSIGHT = 2;

/**
 * The grouping key for a company under a groupBy — neighborhood first, city as
 * fallback (same rule aggregateTerritories uses). Shared by the territory
 * aggregation (server) and the score favorability lookup so both derive the
 * SAME key for the same company. NO per-company fallback: a company without
 * the group field is skipped — the city fallback happens at the GROUPING level
 * (see resolveTerritoryGroupBy).
 */
export function territoryKeyForCompany(
  neighborhood: string | null | undefined,
  city: string | null | undefined,
  groupBy: TerritoryGroupBy,
): string | null {
  const value = (groupBy === "neighborhood" ? neighborhood : city)?.trim();
  return value ? value : null;
}

/**
 * The effective grouping: neighborhood when ANY company has one, city
 * otherwise. The same rule the UI TerritoriesView uses — both sides must agree
 * or the persisted keys would not match the client-side fallback.
 */
export function resolveTerritoryGroupBy(
  companies: Array<{ neighborhood?: string | null; city?: string | null }>,
): TerritoryGroupBy {
  return companies.some((c) => (c.neighborhood ?? "").trim() !== "") ? "neighborhood" : "city";
}

export function aggregateTerritories(
  companies: TerritoryCompany[],
  groupBy: TerritoryGroupBy = "neighborhood",
): TerritoryStats[] {
  const groups = new Map<string, TerritoryCompany[]>();
  for (const c of companies) {
    const key = territoryKeyForCompany(c.neighborhood, c.city, groupBy);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const stats: TerritoryStats[] = [];
  for (const [key, list] of groups) {
    const withoutWebsite = list.filter((c) => !c.hasWebsite).length;
    const avgScore = list.length
      ? Math.round(list.reduce((s, c) => s + c.score, 0) / list.length)
      : 0;
    stats.push({
      key,
      companyCount: list.length,
      hotCount: list.filter((c) => c.temperature === "hot").length,
      avgScore,
      withoutWebsite,
      withoutWebsiteRatio: list.length ? withoutWebsite / list.length : 0,
    });
  }
  return stats.sort((a, b) => b.companyCount - a.companyCount);
}

export interface TerritoryInsight {
  kind: "digital_gap" | "hot_density";
  territoryKey: string;
  message: string;
  /** 0..1 — grows with sample size; small samples → low confidence. */
  confidence: number;
}

function confidenceFromSample(n: number): number {
  return Math.round(Math.min(1, 0.5 + (n - MIN_TERRITORY_SAMPLE) * 0.1) * 100) / 100;
}

export { confidenceFromSample };

/** Hot-density threshold — same ruler the hot_density insight uses. */
export const HOT_DENSITY_FAVOR_RATIO = 0.4;
/** Digital-gap (without-website ratio) delta that saturates favorability. */
export const DIGITAL_GAP_FAVOR_DELTA = 0.2;

/**
 * Territory favorability for one region — the input of the opportunity score's
 * `territory` component (spec #40–41). 0..1, or null when the sample is too
 * small to say ANYTHING (component stays neutral — never invent).
 *
 * Blend: hot concentration (hotRatio vs HOT_DENSITY_FAVOR_RATIO) + digital gap
 * relative to the mean of eligible regions (saturates at DIGITAL_GAP_FAVOR_DELTA),
 * scaled by the sample confidence. An emitted insight for the region adds a
 * small confirmation boost.
 */
export function territoryFavorabilityFor(
  stats: TerritoryStats[],
  insights: TerritoryInsight[],
  key: string,
): number | null {
  const t = stats.find((s) => s.key === key);
  if (!t || t.companyCount < MIN_TERRITORY_SAMPLE) return null;

  const eligible = stats.filter((s) => s.companyCount >= MIN_TERRITORY_SAMPLE);
  if (eligible.length < MIN_TERRITORIES_FOR_INSIGHT) return null; // no comparative base

  const total = eligible.reduce((s, x) => s + x.companyCount, 0);
  const totalWithout = eligible.reduce((s, x) => s + x.withoutWebsite, 0);
  const meanRatio = total ? totalWithout / total : 0;

  const hotRatio = t.hotCount / t.companyCount;
  const hotFavor = Math.min(1, hotRatio / HOT_DENSITY_FAVOR_RATIO);

  const gap = t.withoutWebsiteRatio - meanRatio;
  const gapFavor = Math.max(0, Math.min(1, 0.5 + gap / DIGITAL_GAP_FAVOR_DELTA));

  const hasInsight = insights.some((i) => i.territoryKey === key);
  const blend = (hotFavor + gapFavor) / 2 + (hasInsight ? 0.1 : 0);

  const confidence = confidenceFromSample(t.companyCount);
  const raw = Math.min(1, blend) * confidence;
  return Math.round(raw * 100) / 100;
}

/**
 * Comparative insights (spec #41). Emitted only when there is enough data —
 * never an assertion about a region with an insufficient sample.
 */
export function buildTerritoryInsights(territories: TerritoryStats[]): TerritoryInsight[] {
  const eligible = territories.filter((t) => t.companyCount >= MIN_TERRITORY_SAMPLE);
  if (eligible.length < MIN_TERRITORIES_FOR_INSIGHT) return [];

  const total = eligible.reduce((s, t) => s + t.companyCount, 0);
  const totalWithout = eligible.reduce((s, t) => s + t.withoutWebsite, 0);
  const meanRatio = total ? totalWithout / total : 0;

  const insights: TerritoryInsight[] = [];
  for (const t of eligible) {
    const gap = t.withoutWebsiteRatio - meanRatio;
    if (gap >= 0.2) {
      // When the baseline is near zero the relative "% acima da média" explodes
      // (e.g. 0.01 → "2900%"). Switch to an absolute, still-actionable message.
      const message =
        meanRatio < 0.05
          ? `${t.key}: ${Math.round(t.withoutWebsiteRatio * 100)}% das empresas não possuem site (média geral ${Math.round(meanRatio * 100)}%).`
          : `${t.key} possui ${Math.round((gap / meanRatio) * 100)}% mais empresas sem site que a média das regiões analisadas.`;
      insights.push({
        kind: "digital_gap",
        territoryKey: t.key,
        message,
        confidence: confidenceFromSample(t.companyCount),
      });
    }

    const hotRatio = t.hotCount / t.companyCount;
    if (hotRatio >= 0.4) {
      insights.push({
        kind: "hot_density",
        territoryKey: t.key,
        message: `Alta concentração de oportunidades quentes em ${t.key} (${t.hotCount} de ${t.companyCount}).`,
        confidence: confidenceFromSample(t.companyCount),
      });
    }
  }
  return insights;
}

// ── Heatmap weight ──────────────────────────────────────────────────────────

/**
 * Configurable heat weight (spec #39). The conceptual formula is
 * `opportunityScore × confidence × localDensityFactor`; this is its robust,
 * configurable realization as a weighted blend in [0,1] (a product would zero
 * out isolated high-opportunity businesses when density is 0, which is wrong
 * for an opportunity heatmap).
 */
export const DEFAULT_HEAT_WEIGHTS = {
  opportunityScore: 0.6,
  confidence: 0.2,
  localDensityFactor: 0.2,
} as const;

export function heatWeight(
  factors: {
    opportunityScore: number; // 0..100
    confidence: number; // 0..1
    localDensityFactor: number; // 0..1
  },
  weights: typeof DEFAULT_HEAT_WEIGHTS = DEFAULT_HEAT_WEIGHTS,
): number {
  const score = Math.max(0, Math.min(100, factors.opportunityScore)) / 100;
  const conf = Math.max(0, Math.min(1, factors.confidence));
  const density = Math.max(0, Math.min(1, factors.localDensityFactor));
  const den = weights.opportunityScore + weights.confidence + weights.localDensityFactor;
  const num =
    score * weights.opportunityScore +
    conf * weights.confidence +
    density * weights.localDensityFactor;
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

// ── Heatmap by metric ──────────────────────────────────────────────────────

/** The metric a heatmap layer can represent (spec #38). */
export const HEAT_METRICS = [
  "opportunity",
  "density",
  "weak_digital",
  "segment_concentration",
] as const;
export type HeatMetric = (typeof HEAT_METRICS)[number];

/** Share of a segment (0..1) at which concentration reads as fully hot. */
export const SEGMENT_CONCENTRATION_SATURATION = 0.5;

/**
 * Weight of a single point for a given heatmap metric, in [0,1].
 *   - opportunity: driven by the opportunity score (0 = non-opportunity).
 *   - density:     every company contributes equally (pure geographic density).
 *   - weak_digital: no-website businesses burn hotter.
 *   - segment_concentration: hotter where ONE segment dominates the region
 *     (segmentShare = the company's segment share in the visible set) — the
 *     "região de nicho" insight. Satura em 50% do conjunto.
 */
export function heatMetricWeight(
  metric: HeatMetric,
  input: {
    score: number;
    hasWebsite: boolean;
    /** Share of this company's segment (0..1) in the visible result set. */
    segmentShare?: number | null;
  },
): number {
  switch (metric) {
    case "density":
      return 1;
    case "weak_digital":
      return input.hasWebsite ? 0.15 : 1;
    case "segment_concentration":
      return segmentConcentrationWeight(input.segmentShare);
    case "opportunity":
    default:
      return Math.max(0, Math.min(1, input.score / 100));
  }
}

/** Pure segment-concentration weight: 0 for absent/zero share, 1 at/above the
 * saturation threshold. No share data → 0 (never fabricate a hot zone). */
export function segmentConcentrationWeight(segmentShare: number | null | undefined): number {
  if (segmentShare == null || !Number.isFinite(segmentShare) || segmentShare <= 0) return 0;
  return Math.max(0, Math.min(1, segmentShare / SEGMENT_CONCENTRATION_SATURATION));
}
