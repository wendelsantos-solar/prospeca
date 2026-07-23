import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import { Loader2 } from "lucide-react";

interface UsageSummary {
  from: string;
  to: string;
  searches: number;
  cacheHits: number;
  hitRate: number;
  searchPages: number;
  placeDetails: number;
  geocodes: number;
  forcedRefreshes: number;
  estCostUsd: number;
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

/** Custo & uso da API no mês corrente (Fase 1 — instrumentação). Só modo real. */
export function UsageCostCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => invokeFunction<UsageSummary>("get-usage-summary", {}),
    enabled: isRealMode,
    staleTime: 60_000,
  });

  if (!isRealMode) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custo &amp; uso da API (mês)</CardTitle>
        <CardDescription>
          Estimativa — calibre as taxas contra a fatura real do Google. Cache hit = custo zero.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {error && <div className="text-sm text-destructive">Falha ao carregar uso.</div>}
        {data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Custo estimado"
              value={`US$ ${(data.estCostUsd ?? 0).toFixed(2)}`}
              highlight
            />
            <Stat
              label="Cache hit-rate"
              value={`${Math.round((data.hitRate ?? 0) * 100)}%`}
              highlight
            />
            <Stat label="Buscas" value={String(data.searches ?? 0)} />
            <Stat label="Servidas do cache" value={String(data.cacheHits ?? 0)} />
            <Stat label="Páginas Google" value={String(data.searchPages ?? 0)} />
            <Stat label="Place details" value={String(data.placeDetails ?? 0)} />
            <Stat label="Geocodes" value={String(data.geocodes ?? 0)} />
            <Stat label="Atualizações forçadas" value={String(data.forcedRefreshes ?? 0)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
