// Load test for the deterministic discovery pipeline (no network, no DB).
// Measures throughput of opportunity scoring, territory aggregation and heat
// weighting over synthetic companies so O(n) vs O(n²) regressions surface
// before they reach prod. Run: `bun run scripts/load-test-discovery.ts`.
import {
  calculateOpportunityScore,
  aggregateTerritories,
  heatMetricWeight,
} from "@leads/domain";
import type { CompanySignal, TerritoryCompany } from "@leads/domain";

const BASE_SIGNALS: CompanySignal[] = [
  "VALID_PHONE",
  "WHATSAPP_VALIDATED",
  "HAS_EMAIL",
  "BUSINESS_ACTIVE",
  "HIGH_RATING",
];

function syntheticCompany(i: number): {
  scoreInput: Parameters<typeof calculateOpportunityScore>[0];
  territory: TerritoryCompany;
} {
  const hasWebsite = i % 3 === 0;
  const signals: CompanySignal[] = hasWebsite
    ? BASE_SIGNALS
    : [...BASE_SIGNALS.filter((s) => s !== "HAS_EMAIL"), "NO_WEBSITE"];
  const rating = 3.5 + (i % 10) / 10;
  const scoreInput = {
    signals,
    rating,
    reviewCount: (i * 7) % 500,
    hasWebsite,
    whatsappStatus: (i % 2 === 0 ? "verified" : "unknown") as "verified" | "unknown",
    intentMatch: 0.5 + (i % 5) / 10,
    territoryFavorability: 0.5,
    freshnessDays: i % 20,
  };
  const score = calculateOpportunityScore(scoreInput).total;
  const territory: TerritoryCompany = {
    id: `c${i}`,
    neighborhood: `Bairro ${i % 40}`,
    city: "Porto Alegre",
    score,
    temperature: score >= 75 ? "hot" : score >= 45 ? "warm" : "cold",
    hasWebsite,
  };
  return { scoreInput, territory };
}

function bench(label: string, ops: number, fn: () => void): void {
  const t0 = performance.now();
  fn();
  const ms = performance.now() - t0;
  const opsPerSec = Math.round(ops / (ms / 1000));
  console.log(
    `${label.padEnd(30)} ${ops.toLocaleString("pt-BR").padStart(10)} ops em ${ms.toFixed(1).padStart(7)}ms → ${opsPerSec.toLocaleString("pt-BR").padStart(12)} ops/s`,
  );
}

function main(): void {
  const N = 50_000;
  const companies = Array.from({ length: N }, (_, i) => syntheticCompany(i));
  console.log(`\nPipeline determinístico — ${N.toLocaleString("pt-BR")} empresas sintéticas\n`);

  bench("calculateOpportunityScore", N, () => {
    for (const c of companies) calculateOpportunityScore(c.scoreInput);
  });

  bench("aggregateTerritories", N, () => {
    aggregateTerritories(companies.map((c) => c.territory));
  });

  bench("heatMetricWeight (opportunity)", N, () => {
    for (const c of companies) {
      heatMetricWeight("opportunity", { score: c.territory.score, hasWebsite: c.territory.hasWebsite });
    }
  });

  console.log("\nConcluído.");
}

main();
