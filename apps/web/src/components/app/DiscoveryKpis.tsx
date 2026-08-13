import { Building2, Flame, Gauge, GlobeLock } from "lucide-react";
import type { DiscoveryKpis } from "@/lib/discovery-kpis";

/** KPI strip for the discovery workspace — empresas encontradas, oportunidades
 * quentes, score médio e negócios sem site. Derived from the loaded results,
 * no extra round-trip. */
export function DiscoveryKpis({ kpis }: { kpis: DiscoveryKpis }) {
  const items = [
    { icon: Building2, label: "Empresas encontradas", value: kpis.total },
    { icon: Flame, label: "Oportunidades quentes", value: kpis.hot },
    { icon: Gauge, label: "Score médio", value: kpis.avgScore },
    { icon: GlobeLock, label: "Sem site", value: kpis.withoutWebsite },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{it.label}</span>
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums leading-none text-foreground">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
