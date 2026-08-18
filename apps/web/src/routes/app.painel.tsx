import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useDashboardOverview } from "@/hooks/useLeadsQuery";
import { usePeriodStore } from "@/stores";
import { resolvePeriod, previousWindow } from "@/lib/period";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValueProofView } from "@/components/app/ValueProofView";
import { valueProofFromAllTime } from "@/lib/value-proof";

const Dashboard = lazy(() =>
  import("@/components/app/Dashboard").then((m) => ({ default: m.Dashboard })),
);

type PainelTab = "conversion" | "value";

export const Route = createFileRoute("/app/painel")({
  component: PainelPage,
  head: () => ({ meta: [{ title: "Análises — Prospeca" }] }),
});

function PainelSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function PainelPage() {
  // Fase 4.2: métricas do painel vêm do SERVIDOR (get_dashboard_overview,
  // membership check, agregação sobre a carteira INTEIRA) — nunca do array
  // truncado de 50 leads.
  const period = usePeriodStore((s) => s.period);
  const customFrom = usePeriodStore((s) => s.customFrom);
  const customTo = usePeriodStore((s) => s.customTo);
  const win = useMemo(
    () => resolvePeriod(period, customFrom, customTo),
    [period, customFrom, customTo],
  );
  const prevWin = useMemo(() => previousWindow(win), [win]);
  const { current, previous } = useDashboardOverview(win, prevWin);
  const [tab, setTab] = useState<PainelTab>("conversion");

  const isLoading = current.isLoading || previous.isLoading;
  const error = current.error ?? previous.error;
  const retry = () => {
    void current.refetch();
    void previous.refetch();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold">Análises</h1>
            <p className="text-[12.5px] text-muted-foreground">
              {tab === "conversion"
                ? "Métricas de leads, funil e receita no período."
                : "Um resumo real do seu trabalho, pronto para mostrar."}
            </p>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as PainelTab)}>
            <TabsList className="h-auto rounded-md border border-border bg-surface p-0.5">
              <TabsTrigger
                value="conversion"
                className="rounded px-2.5 py-1 text-[12px] font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Conversão
              </TabsTrigger>
              <TabsTrigger
                value="value"
                className="rounded px-2.5 py-1 text-[12px] font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
              >
                Prova de valor
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <PainelSkeleton />
        ) : error ? (
          <ErrorState
            title="Falha ao carregar o painel"
            description="Não foi possível carregar as métricas. Verifique sua conexão."
            onRetry={retry}
          />
        ) : tab === "conversion" ? (
          <Suspense fallback={<PainelSkeleton />}>
            <Dashboard current={current.data!} previous={previous.data!} />
          </Suspense>
        ) : (
          <ValueProofView vp={valueProofFromAllTime(current.data!.allTime)} />
        )}
      </div>
    </div>
  );
}
