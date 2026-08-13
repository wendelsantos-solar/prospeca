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

export function aggregateTerritories(
  companies: TerritoryCompany[],
  groupBy: TerritoryGroupBy = "neighborhood",
): TerritoryStats[] {
  const groups = new Map<string, TerritoryCompany[]>();
  for (const c of companies) {
    const key = (groupBy === "city" ? c.city : c.neighborhood)?.trim();
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
  const num = score * weights.opportunityScore + conf * weights.confidence + density * weights.localDensityFactor;
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}

// ── Heatmap by metric ──────────────────────────────────────────────────────

/** The metric a heatmap layer can represent (spec #38). */
export const HEAT_METRICS = ["opportunity", "density", "weak_digital"] as const;
export type HeatMetric = (typeof HEAT_METRICS)[number];

/**
 * Weight of a single point for a given heatmap metric, in [0,1].
 *   - opportunity: driven by the opportunity score (0 = non-opportunity).
 *   - density:     every company contributes equally (pure geographic density).
 *   - weak_digital: no-website businesses burn hotter.
 */
export function heatMetricWeight(
  metric: HeatMetric,
  input: { score: number; hasWebsite: boolean },
): number {
  switch (metric) {
    case "density":
      return 1;
    case "weak_digital":
      return input.hasWebsite ? 0.15 : 1;
    case "opportunity":
    default:
      return Math.max(0, Math.min(1, input.score / 100));
  }
}
