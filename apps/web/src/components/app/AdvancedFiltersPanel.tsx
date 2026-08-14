import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useUIStore } from "@/stores";
import {
  applyAdvancedDiscoveryFilters,
  hasAdvancedFilters,
  type AdvancedDiscoveryFilters,
} from "@/lib/filters";
import type { DiscoveryResult } from "@/repositories/types";
import { cn } from "@/lib/utils";

const ENRICHMENT_OPTIONS = [
  { v: "pending", l: "Pendente" },
  { v: "processing", l: "Verificando" },
  { v: "enriched", l: "Enriquecida" },
  { v: "partial", l: "Parcial" },
  { v: "failed", l: "Falhou" },
] as const;

const SIGNAL_OPTIONS = [
  { v: "no_website", l: "Sem site" },
  { v: "has_website", l: "Com site" },
  { v: "has_whatsapp", l: "Com WhatsApp" },
  { v: "has_phone", l: "Com telefone" },
  { v: "has_email", l: "Com e-mail" },
] as const;

const BAND_OPTIONS = [
  { v: "high", l: "Confiança alta" },
  { v: "medium", l: "Confiança média" },
  { v: "low", l: "Confiança baixa" },
  { v: "unknown", l: "Sem confiança ainda" },
] as const;

/**
 * Advanced discovery filters (V3-A) — progressive disclosure: collapsed by
 * default, filters only over data ALREADY present on DiscoveryResult (segment,
 * neighborhood/city, confidence band, enrichment status, contact signals).
 * Honest: no filter invents data — absent fields simply don't match.
 */
export function AdvancedFiltersPanel() {
  const filters = useUIStore((s) => s.advancedFilters);
  const setFilters = useUIStore((s) => s.setAdvancedFilters);
  const [open, setOpen] = useState(false);
  const active = hasAdvancedFilters(filters);

  const patch = (p: Partial<AdvancedDiscoveryFilters>) => setFilters(p);

  const selectCls =
    "h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
          active
            ? "border-primary/40 bg-primary-soft text-primary"
            : "border-border bg-surface text-foreground hover:bg-surface-hover",
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtros
        {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-surface p-3 shadow-elevated">
          <div className="space-y-2.5">
            <input
              value={filters.segment ?? ""}
              onChange={(e) => patch({ segment: e.target.value || undefined })}
              placeholder="Segmento (ex: barbearia)"
              aria-label="Filtrar por segmento"
              className="h-7 w-full rounded-md border border-border bg-surface px-2 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
            />
            <div className="flex gap-1.5">
              <input
                value={filters.neighborhood ?? ""}
                onChange={(e) => patch({ neighborhood: e.target.value || undefined })}
                placeholder="Bairro"
                aria-label="Filtrar por bairro"
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              />
              <input
                value={filters.city ?? ""}
                onChange={(e) => patch({ city: e.target.value || undefined })}
                placeholder="Cidade"
                aria-label="Filtrar por cidade"
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              />
            </div>
            <div className="flex gap-1.5">
              <select
                value={filters.confidenceBand ?? ""}
                onChange={(e) =>
                  patch({
                    confidenceBand: (e.target.value || undefined) as
                      | AdvancedDiscoveryFilters["confidenceBand"]
                      | undefined,
                  })
                }
                aria-label="Banda de confiança"
                className={selectCls}
              >
                <option value="">Confiança (todas)</option>
                {BAND_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
              <select
                value={filters.enrichmentStatus ?? ""}
                onChange={(e) =>
                  patch({
                    enrichmentStatus: (e.target.value || undefined) as
                      | AdvancedDiscoveryFilters["enrichmentStatus"]
                      | undefined,
                  })
                }
                aria-label="Status de enriquecimento"
                className={selectCls}
              >
                <option value="">Enriquecimento (todos)</option>
                {ENRICHMENT_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={filters.signal ?? ""}
              onChange={(e) =>
                patch({
                  signal: (e.target.value || undefined) as
                    | AdvancedDiscoveryFilters["signal"]
                    | undefined,
                })
              }
              aria-label="Sinal de contato"
              className={cn(selectCls, "w-full")}
            >
              <option value="">Sinal de contato (todos)</option>
              {SIGNAL_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
            {active && (
              <button
                type="button"
                onClick={() => setFilters({})}
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Apply the active advanced filters to discovery results. */
export function useFilteredResults(results: DiscoveryResult[]): DiscoveryResult[] {
  const filters = useUIStore((s) => s.advancedFilters);
  return applyAdvancedDiscoveryFilters(results, filters);
}
