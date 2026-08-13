import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { aggregateTerritories, buildTerritoryInsights, MIN_TERRITORY_SAMPLE } from "@leads/domain";
import type { DiscoveryResult } from "@/repositories/types";

/**
 * Territórios — aggregates the current discovery results by region (neighborhood,
 * falling back to city) and surfaces comparative insights (spec #37, #40, #41).
 * Pure client-side over the already-loaded results, using the shared domain.
 */
export function TerritoriesView({ results }: { results: DiscoveryResult[] }) {
  const { territories, insights } = useMemo(() => {
    const companies = results.map((r) => ({
      id: r.placeId,
      neighborhood: r.neighborhood ?? null,
      city: r.city ?? null,
      score: r.score,
      temperature: r.temperature,
      hasWebsite: r.hasWebsite,
    }));
    const byNeighborhood = aggregateTerritories(companies, "neighborhood");
    const territories =
      byNeighborhood.length > 0 ? byNeighborhood : aggregateTerritories(companies, "city");
    return { territories, insights: buildTerritoryInsights(territories) };
  }, [results]);

  if (territories.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
        Sem dados territoriais para exibir nesta busca.
      </div>
    );
  }

  const anySmallSample = territories.some((t) => t.companyCount < MIN_TERRITORY_SAMPLE);

  return (
    <div className="h-full overflow-y-auto p-4">
      {insights.length > 0 && (
        <div className="mb-3 space-y-2">
          {insights.map((ins, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-subtle px-3 py-2 text-caption"
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="text-foreground">
                {ins.message}{" "}
                <span className="text-micro text-muted-foreground">
                  · confiança {Math.round(ins.confidence * 100)}%
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {territories.map((t) => (
          <div key={t.key} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-body-sm font-semibold text-foreground">{t.key}</p>
              <span className="shrink-0 text-micro text-muted-foreground">
                {t.companyCount} empresas
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">{t.hotCount}</p>
                <p className="text-[10px] text-muted-foreground">quentes</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">{t.avgScore}</p>
                <p className="text-[10px] text-muted-foreground">score médio</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {Math.round(t.withoutWebsiteRatio * 100)}%
                </p>
                <p className="text-[10px] text-muted-foreground">sem site</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {insights.length === 0 && anySmallSample && (
        <p className="mt-3 text-center text-micro text-muted-foreground">
          Insights comparativos aparecem com amostras maiores ({MIN_TERRITORY_SAMPLE}+ empresas por
          região).
        </p>
      )}
    </div>
  );
}
