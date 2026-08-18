import { Building2, Flame, Gauge, GlobeLock, Coins } from "lucide-react";
import type { DiscoveryKpis } from "@/lib/discovery-kpis";
import { cn } from "@/lib/utils";

/** KPI strip for the discovery workspace — empresas encontradas, oportunidades
 * quentes, score médio e negócios sem site. Derived from the loaded results,
 * no extra round-trip. When the current search carries a pre-flight estimate,
 * an honest "estimativa" tile shows the persisted range (never exact).
 * Fase 90: tile com CÍRCULO colorido claro + ícone (mockup). */
export function DiscoveryKpis({
  kpis,
  estimate,
}: {
  kpis: DiscoveryKpis;
  estimate?: { costUsdMax: number; resultsMax: number } | null;
}) {
  const items = [
    {
      icon: Building2,
      label: "Empresas encontradas",
      value: kpis.total,
      circle: "bg-primary-soft text-primary",
    },
    {
      icon: Flame,
      label: "Oportunidades quentes",
      value: kpis.hot,
      circle: "bg-hot-soft text-hot",
    },
    {
      icon: Gauge,
      label: "Score médio",
      value: kpis.avgScore,
      circle: "bg-info/10 text-info",
    },
    {
      icon: GlobeLock,
      label: "Sem site",
      value: kpis.withoutWebsite,
      circle: "bg-warm-soft text-warm-foreground",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-1.5"
        >
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", it.circle)}>
            <it.icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[20px] font-semibold leading-tight tabular-nums text-foreground">
              {it.value}
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              {it.label}
            </div>
          </div>
        </div>
      ))}
      {estimate != null && (
        <div
          className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-1.5"
          title="Estimativa pré-busca — range honesto, nunca valor exato"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <Coins className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight tabular-nums text-foreground">
              ~{estimate.resultsMax} · US$ {estimate.costUsdMax.toFixed(3)}
            </div>
            <div className="truncate text-[11px] leading-tight text-muted-foreground">
              Estimativa (busca)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
