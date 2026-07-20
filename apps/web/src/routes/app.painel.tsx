import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = lazy(() =>
  import("@/components/app/Dashboard").then((m) => ({ default: m.Dashboard })),
);

const DEFAULT_FILTERS = { quick: [] };

export const Route = createFileRoute("/app/painel")({
  component: PainelPage,
  head: () => ({ meta: [{ title: "Painel — Radar Local" }] }),
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
  const { data } = useLeadsList(DEFAULT_FILTERS);
  const leads = data?.items ?? [];
  return (
    <div className="h-full overflow-y-auto">
      <Suspense fallback={<PainelSkeleton />}>
        <Dashboard leads={leads} />
      </Suspense>
    </div>
  );
}
