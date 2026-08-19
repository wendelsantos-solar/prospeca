import { useMemo } from "react";
import { Info, ChevronUp, ChevronDown } from "lucide-react";
import type { DiscoveryResult } from "@/repositories/types";
import { useUIStore } from "@/stores";
import { MARKER_HEX, HEAT_GRADIENT_CSS } from "./map-popup";
import { cn } from "@/lib/utils";

const LEGEND_ITEMS = [
  { label: "Muito alta", color: MARKER_HEX.hot },
  { label: "Alta", color: MARKER_HEX.warm },
  { label: "Média", color: MARKER_HEX.cold },
  { label: "No funil", color: MARKER_HEX.funnel },
  { label: "Selecionado", color: MARKER_HEX.selected },
] as const;

/** Barras de presença digital (Fase 90 — mockup): contagem HONESTO derivada
 * do resultado carregado. Média = site + alguma rede; Fraca = parcial;
 * Ausente = nada. Nunca número inventado. */
function presenceBars(results: DiscoveryResult[]) {
  let media = 0;
  let fraca = 0;
  let ausente = 0;
  for (const r of results) {
    const social = !!r.instagram || !!r.whatsapp;
    const site = r.hasWebsite;
    if (!site && !social) ausente++;
    else if (site && social) media++;
    else fraca++;
  }
  return { media, fraca, ausente };
}

/**
 * Legenda compartilhada do mapa (Fase 90) — 2 COLUNAS como o mockup:
 * Níveis de oportunidade (mesmas cores dos markers) | Presença digital
 * (3 barras com contagens reais como tooltip). Rodapé: 'Raio: N km'.
 * Colapsável via mapLegendCollapsed (persistido).
 */
export function MapLegend({
  mode,
  results,
  radiusKm,
}: {
  mode: "markers" | "heatmap";
  results: DiscoveryResult[];
  radiusKm: number;
}) {
  const mapLegendCollapsed = useUIStore((s) => s.mapLegendCollapsed);
  const setMapLegendCollapsed = useUIStore((s) => s.setMapLegendCollapsed);

  const bars = useMemo(() => presenceBars(results), [results]);

  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-surface/95 shadow-elevated backdrop-blur">
      <button
        type="button"
        onClick={() => setMapLegendCollapsed(!mapLegendCollapsed)}
        aria-expanded={!mapLegendCollapsed}
        aria-label={mapLegendCollapsed ? "Expandir legenda" : "Recolher legenda"}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
        Legenda
        {mapLegendCollapsed ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {!mapLegendCollapsed &&
        (mode === "heatmap" ? (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Baixa</span>
            <span className="h-2 flex-1 rounded-full" style={{ background: HEAT_GRADIENT_CSS }} />
            <span className="text-[11px] font-medium text-muted-foreground">Alta oportunidade</span>
          </div>
        ) : (
          <div className="space-y-2 border-t border-border px-3 py-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Níveis de oportunidade
                </p>
                <div className="space-y-1">
                  {LEGEND_ITEMS.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: l.color }}
                      />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Presença digital
                </p>
                <div className="space-y-1">
                  {[
                    { label: "Média", count: bars.media, cls: "bg-primary/70" },
                    { label: "Fraca", count: bars.fraca, cls: "bg-warm/70" },
                    { label: "Ausente", count: bars.ausente, cls: "bg-muted-foreground/50" },
                  ].map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                      title={`${b.label}: ${b.count} ${b.count === 1 ? "empresa" : "empresas"} no resultado carregado`}
                    >
                      <span className={cn("h-3 w-1.5 shrink-0 rounded-sm", b.cls)} aria-hidden />
                      {b.label}
                      <span className="tabular-nums text-subtle-foreground">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-border/60 pt-1.5 text-[11px] font-medium text-muted-foreground">
              Raio:{" "}
              <b className="text-foreground">
                {radiusKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
              </b>
            </div>
          </div>
        ))}
    </div>
  );
}
