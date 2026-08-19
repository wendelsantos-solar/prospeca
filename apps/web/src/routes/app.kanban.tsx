import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from "react";
import { useLeadsStore, useUIStore } from "@/stores";
import { applyFilters, sortLeads } from "@/lib/filters";
import { KanbanSkeleton } from "@/components/shared/Skeletons";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  useLeadsListInfinite,
  useLeadStageCounts,
  useOrganizationMembers,
  useExportPipelineMutation,
} from "@/hooks/useLeadsQuery";
import { toast } from "sonner";

// Lazy-load KanbanBoard (dnd-kit ~100KB) — only when user visits this route
const KanbanBoard = lazy(() =>
  import("@/components/app/KanbanBoard").then((m) => ({ default: m.KanbanBoard })),
);
const KanbanTopBar = lazy(() =>
  import("@/components/app/KanbanBoard").then((m) => ({ default: m.KanbanTopBar })),
);

// Inline these to avoid loading the heavy module just for constants
interface KanbanFilters {
  temperature: import("@/types").LeadTemperature | "all";
  city: string | "all";
  category: string | "all";
  stage: import("@/types").LeadStage | "all";
  channel: import("@/types").LeadChannel | "website" | "all";
  assignee: string | "all";
}
const EMPTY_KANBAN_FILTERS: KanbanFilters = {
  temperature: "all",
  city: "all",
  category: "all",
  stage: "all",
  channel: "all",
  assignee: "all",
};

function applyKanbanFilters(leads: import("@/types").Lead[], f: KanbanFilters) {
  return leads.filter((l) => {
    if (f.temperature !== "all" && l.temperature !== f.temperature) return false;
    if (f.city !== "all" && l.city !== f.city) return false;
    if (f.category !== "all" && l.category !== f.category) return false;
    if (f.stage !== "all" && l.stage !== f.stage) return false;
    if (f.assignee !== "all" && l.assignedTo !== f.assignee) return false;
    if (f.channel !== "all") {
      if (f.channel === "whatsapp" && !l.whatsapp) return false;
      if (f.channel === "phone" && !l.phone) return false;
      if (f.channel === "instagram" && !l.instagram) return false;
      if (f.channel === "email" && !l.email) return false;
      if (f.channel === "website" && !l.hasWebsite) return false;
    }
    return true;
  });
}

export const Route = createFileRoute("/app/kanban")({
  component: KanbanPage,
  head: () => ({ meta: [{ title: "Kanban — Prospeca" }] }),
});

function KanbanPage() {
  const filters = useLeadsStore((s) => s.filters);
  const sort = useLeadsStore((s) => s.sort);
  const searching = useLeadsStore((s) => s.searching);
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const selected = useLeadsStore((s) => s.selectedIds);
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const setBulkMode = useLeadsStore((s) => s.setBulkMode);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kFilters, setKFilters] = useState<KanbanFilters>(EMPTY_KANBAN_FILTERS);

  // Fase 4.1: paginação REAL — infinite query, total do servidor visível.
  const infinite = useLeadsListInfinite(filters, sort);
  const stageCountsQ = useLeadStageCounts();
  const membersQ = useOrganizationMembers();
  const [exporting, setExporting] = useState(false);
  const exportMut = useExportPipelineMutation();
  const allLeads = useMemo(
    () => (infinite.data?.pages ?? []).flatMap((p) => p.items),
    [infinite.data],
  );
  const serverTotal = infinite.data?.pages[0]?.total ?? 0;
  const hasMore = infinite.hasNextPage;
  const isLoading = infinite.isLoading;
  const error = infinite.error;
  const refetch = () => void infinite.refetch();

  const membersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data ?? []) {
      if (m.fullName) map.set(m.userId, m.fullName);
    }
    return map;
  }, [membersQ.data]);

  const handleExport = useCallback(
    async (format: "csv" | "xlsx") => {
      setExporting(true);
      try {
        // P1-b: export via REPOSITÓRIO (abstração única do app). O repositório
        // chama create-export e TRADUZ o erro para mensagem de usuário
        // (401 sessão / 429 rate limit / entitlement) — nunca mensagem técnica.
        const blob = await exportMut.mutateAsync({
          format,
          filters: {
            stages: filters.stages?.length ? filters.stages : undefined,
            temperatures: filters.temperatures?.length ? filters.temperatures : undefined,
            cities: kFilters.city !== "all" ? [kFilters.city] : undefined,
            categories: kFilters.category !== "all" ? [kFilters.category] : undefined,
            minScore: filters.minScore ?? undefined,
            hasWebsite: filters.hasWebsite ?? undefined,
            hasPhone: filters.hasPhone ?? undefined,
            hasWhatsapp: filters.hasWhatsapp ?? undefined,
            hasEmail: filters.hasEmail ?? undefined,
            hasInstagram: filters.hasInstagram ?? undefined,
            assignee: kFilters.assignee !== "all" ? kFilters.assignee : undefined,
            discoveredAfter: filters.discoveredAfter ?? undefined,
            lastInteractionAfter: filters.lastInteractionAfter ?? undefined,
            valueMin: filters.valueMin ?? undefined,
            valueMax: filters.valueMax ?? undefined,
            search: deferredSearch || undefined,
          },
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Exportação concluída");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível exportar agora.");
      } finally {
        setExporting(false);
      }
    },
    [filters, kFilters, deferredSearch, exportMut],
  );

  const cities = useMemo(
    () => [...new Set(allLeads.map((l) => l.city).filter(Boolean))].sort(),
    [allLeads],
  );
  const categories = useMemo(
    () => [...new Set(allLeads.map((l) => l.category).filter(Boolean))].sort(),
    [allLeads],
  );

  const filtered = useMemo(() => {
    let base = sortLeads(applyFilters(allLeads, filters), sort);
    base = applyKanbanFilters(base, kFilters);
    return deferredSearch
      ? base.filter((l) => l.companyName.toLowerCase().includes(deferredSearch.toLowerCase()))
      : base;
  }, [allLeads, filters, sort, deferredSearch, kFilters]);

  if ((searching || isLoading) && allLeads.length === 0) {
    return <KanbanSkeleton />;
  }

  if (error && allLeads.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <ErrorState
          title="Falha ao carregar os leads"
          description="Não foi possível carregar o pipeline. Verifique sua conexão."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">Pipeline</h1>
      <Suspense fallback={<KanbanSkeleton />}>
        <KanbanTopBar
          search={search}
          setSearch={setSearch}
          density={density}
          setDensity={setDensity}
          count={serverTotal}
          loadedCount={allLeads.length}
          selected={selected.length}
          bulkMode={bulkMode}
          onToggleBulkMode={() => setBulkMode(!bulkMode)}
          onPrepareMessages={() => window.dispatchEvent(new CustomEvent("open-bulk-messages"))}
          onPlanRoute={() => window.dispatchEvent(new CustomEvent("open-route-planner"))}
          filters={kFilters}
          setFilters={setKFilters}
          cities={cities}
          categories={categories}
          members={membersQ.data ?? []}
          onExport={handleExport}
          exporting={exporting}
        />
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            leads={filtered}
            density={density}
            stageCounts={stageCountsQ.data}
            membersById={membersById}
            hasMore={hasMore}
            onLoadMore={() => void infinite.fetchNextPage()}
          />
        </div>
      </Suspense>
    </div>
  );
}
