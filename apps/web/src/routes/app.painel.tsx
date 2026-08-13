import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValueProofView } from "@/components/app/ValueProofView";

const Dashboard = lazy(() =>
  import("@/components/app/Dashboard").then((m) => ({ default: m.Dashboard })),
);

const DEFAULT_FILTERS = { quick: [] };

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
  // CRM real — leads from TanStack Query (Phase 3)
  const { data, isLoading, error, refetch } = useLeadsList(DEFAULT_FILTERS);
  const leads = data?.items ?? [];
  const [tab, setTab] = useState<PainelTab>("conversion");

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
            description="Não foi possível carregar os leads. Verifique sua conexão."
            onRetry={() => refetch()}
          />
        ) : tab === "conversion" ? (
          <Suspense fallback={<PainelSkeleton />}>
            <Dashboard leads={leads} />
          </Suspense>
        ) : (
          <ValueProofView leads={leads} />
        )}
      </div>
    </div>
  );
}
