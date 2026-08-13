import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useDeferredValue, useMemo, useState } from "react";
import { useLeadsStore, useUIStore } from "@/stores";
import { applyFilters, sortLeads } from "@/lib/filters";
import { KanbanSkeleton } from "@/components/shared/Skeletons";
import { ErrorState } from "@/components/shared/ErrorState";
import { useLeadsList } from "@/hooks/useLeadsQuery";

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
}
const EMPTY_KANBAN_FILTERS: KanbanFilters = {
  temperature: "all",
  city: "all",
  category: "all",
  stage: "all",
  channel: "all",
};

function applyKanbanFilters(leads: import("@/types").Lead[], f: KanbanFilters) {
  return leads.filter((l) => {
    if (f.temperature !== "all" && l.temperature !== f.temperature) return false;
    if (f.city !== "all" && l.city !== f.city) return false;
    if (f.category !== "all" && l.category !== f.category) return false;
    if (f.stage !== "all" && l.stage !== f.stage) return false;
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

  // CRM real — leads now come from TanStack Query (Phase 3)
  const { data, isLoading, error, refetch } = useLeadsList(filters, sort);
  const allLeads = useMemo(() => data?.items ?? [], [data]);

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
          count={filtered.length}
          selected={selected.length}
          bulkMode={bulkMode}
          onToggleBulkMode={() => setBulkMode(!bulkMode)}
          onPrepareMessages={() => window.dispatchEvent(new CustomEvent("open-bulk-messages"))}
          onPlanRoute={() => window.dispatchEvent(new CustomEvent("open-route-planner"))}
          filters={kFilters}
          setFilters={setKFilters}
          cities={cities}
          categories={categories}
        />
        <div className="flex-1 overflow-hidden">
          <KanbanBoard leads={filtered} density={density} />
        </div>
      </Suspense>
    </div>
  );
}
