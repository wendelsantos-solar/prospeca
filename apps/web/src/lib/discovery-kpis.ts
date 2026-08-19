import type { DiscoveryResult } from "@leads/contracts";

export interface DiscoveryKpis {
  total: number;
  hot: number;
  avgScore: number;
  withoutWebsite: number;
}

/**
 * Search KPIs derived from the already-loaded discovery results (bounded at
 * ~60 by the Google Text Search cap), so no extra round-trip or RPC is needed.
 */
export function computeDiscoveryKpis(results: DiscoveryResult[]): DiscoveryKpis {
  const total = results.length;
  const hot = results.filter((r) => r.temperature === "hot").length;
  const withoutWebsite = results.filter((r) => !r.hasWebsite).length;
  const avgScore = total === 0 ? 0 : Math.round(results.reduce((s, r) => s + r.score, 0) / total);
  return { total, hot, avgScore, withoutWebsite };
}
