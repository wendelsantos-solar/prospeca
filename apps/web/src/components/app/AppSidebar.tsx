import { useMemo, useEffect, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import {
  Radar,
  Moon,
  Sun,
  Search,
  Phone,
  Globe,
  MessageCircle,
  PanelLeftClose,
  ArrowUpDown,
  Filter,
  Download,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore, useLeadsStore, useSearchDraftStore } from "@/stores";
import { useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { RADIUS_OPTIONS } from "@/lib/constants";
import { SearchForm } from "./SearchForm";
import { DiscoveryCard } from "./DiscoveryCard";
import { HistoryDrawer } from "./HistoryDrawer";
import { SettingsDialog } from "./SettingsDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LeadListSkeleton, SummarySkeleton } from "@/components/shared/Skeletons";
import { filterByRadius } from "@/lib/filters";
import { exportDiscoveryCSV } from "@/lib/export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortBy = "score" | "distance" | "rating";

export function AppSidebar({ mobile }: { mobile?: boolean }) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  const searching = useLeadsStore((s) => s.searching);
  const searchError = useLeadsStore((s) => s.searchError);
  const setSearchError = useLeadsStore((s) => s.setSearchError);
  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const draftCoords = useSearchDraftStore((s) => s.draft.coords);
  const setDraft = useSearchDraftStore((s) => s.setDraft);
  const isAreaTooLargeError = !!searchError?.toLowerCase().includes("raio");
  const smallerRadius = [...RADIUS_OPTIONS].reverse().find((r) => r < radiusKm);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  // The radius slider filters the already-loaded results around the committed
  // search center — NOT draftCoords, which also tracks map pan/zoom (see
  // MapView's syncCenterToDraft) and would silently empty the list on a pan.
  const radiusCenter = currentSearch
    ? { lat: currentSearch.latitude, lng: currentSearch.longitude }
    : draftCoords;
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("score");

  // Discovery list: results of the current search (search_results ⋈ places),
  // NOT the org's accumulated leads. A lead only exists once added to the funnel.
  const { data: discovery } = useDiscoveryResults(currentSearch?.id);
  const results = useMemo(() => discovery ?? [], [discovery]);

  // A map marker click focuses a result but the list has no reason to react on
  // its own — without this the selected card can be scrolled off-screen with
  // no visible feedback that anything changed. Card clicks don't need this:
  // the card is already in view.
  useEffect(() => {
    const onFocusFromMap = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const el = scrollAreaRef.current?.querySelector(`[data-place-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("lead-focused-from-map", onFocusFromMap);
    return () => window.removeEventListener("lead-focused-from-map", onFocusFromMap);
  }, []);

  // Radius is a hard filter, not a dimmed preview — map, list, and counts must
  // all agree on what "inside the radius" means (matches reference product).
  const resultsInRadius = useMemo(
    () => filterByRadius(results, radiusCenter, radiusKm),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on lat/lng primitives to avoid object-ref churn
    [results, radiusCenter.lat, radiusCenter.lng, radiusKm],
  );

  const sortedResults = useMemo(() => {
    const arr = [...resultsInRadius];
    if (sortBy === "score") arr.sort((a, b) => b.score - a.score);
    if (sortBy === "distance") arr.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sortBy === "rating") arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return arr;
  }, [resultsInRadius, sortBy]);

  const summary = useMemo(() => {
    if (!resultsInRadius.length) return null;
    let noSite = 0;
    let phones = 0;
    let whats = 0;
    let inFunnel = 0;
    for (const r of resultsInRadius) {
      if (!r.hasWebsite) noSite++;
      if (r.phone) phones++;
      if (r.whatsapp) whats++;
      if (r.importedLeadId != null) inFunnel++;
    }
    return {
      noSite,
      phones,
      whats,
      inFunnel,
      // Denominador = o que existe de fato na lista/mapa (dentro do raio real),
      // não o found_count bruto do provider (inclui cantos da bbox fora do
      // círculo, que foram descartados no execute-search e não são navegáveis).
      // Mapa, lista e este contador têm que concordar. found_count segue no
      // Histórico, onde é métrica de auditoria da busca.
      total: resultsInRadius.length,
    };
  }, [resultsInRadius]);

  const handleExportCsv = () => {
    try {
      exportDiscoveryCSV(resultsInRadius);
      toast.success(`CSV exportado (${resultsInRadius.length} empresas)`);
    } catch {
      toast.error("Falha ao exportar CSV");
    }
  };

  // Colapsada = some por completo (igual ao reference). O botão de expandir
  // vive no TopNav (PanelLeftOpen) quando sidebarCollapsed.
  if (collapsed && !mobile) return null;

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar",
        mobile
          ? "h-full w-full"
          : "hidden md:flex w-full max-w-[360px] xl:max-w-[400px] shrink-0 border-r",
      )}
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-card">
            <Radar className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">Radar Local</div>
            <div className="truncate text-[11px] text-muted-foreground">Prospecção comercial</div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={toggleTheme} label="Alternar tema">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </IconBtn>
          <SettingsDialog />
          {!mobile && (
            <IconBtn onClick={() => setCollapsed(true)} label="Recolher painel lateral">
              <PanelLeftClose className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      </div>

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* Search block */}
        <div className="border-b border-sidebar-border p-4">
          <div className="mb-3">
            <div className="text-[13px] font-semibold text-foreground">Descobrir empresas</div>
            <div className="text-[11.5px] text-muted-foreground">
              Encontre oportunidades comerciais em uma região.
            </div>
          </div>
          <SearchForm />
        </div>

        {/* Summary */}
        {searching ? (
          <SummarySkeleton />
        ) : summary ? (
          <div className="border-b border-sidebar-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Resumo da pesquisa
              </span>
              <HistoryDrawer />
            </div>
            <div className="grid grid-cols-5 gap-1">
              <SummaryPill label="Encontradas" value={summary.total} />
              <SummaryPill label="Sem site" value={summary.noSite} icon={Globe} />
              <SummaryPill label="Telefones" value={summary.phones} icon={Phone} />
              <SummaryPill label="WhatsApp" value={summary.whats} icon={MessageCircle} />
              <SummaryPill label="Pipeline" value={summary.inFunnel} tone="primary" />
            </div>
          </div>
        ) : null}

        {/* Toolbar */}
        {!!summary && (
          <div className="flex shrink-0 items-center gap-1 border-b border-sidebar-border px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <ArrowUpDown className="h-3 w-3" />
                Ordenar
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSortBy("score")}>
                  Score (maior)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy("distance")}>
                  Distância (menor)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy("rating")}>
                  Avaliação (maior)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => toast.info("Filtros avançados em breve")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Filter className="h-3 w-3" />
              Filtros
            </button>
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={resultsInRadius.length === 0}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  Exportar
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={handleExportCsv}>Exportar CSV</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* List */}
        <div className="min-h-0 flex-1 p-3">
          {searching ? (
            <LeadListSkeleton />
          ) : searchError ? (
            <ErrorState
              title="Falha na busca"
              description={searchError}
              onRetry={() => window.dispatchEvent(new CustomEvent("retry-search"))}
              onSecondary={
                isAreaTooLargeError && smallerRadius
                  ? () => {
                      setDraft({ radiusKm: smallerRadius });
                      window.dispatchEvent(new CustomEvent("retry-search"));
                    }
                  : undefined
              }
              secondaryLabel={
                smallerRadius ? `Reduzir raio para ${smallerRadius}km e tentar` : undefined
              }
              onBack={() => setSearchError(null)}
            />
          ) : resultsInRadius.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma empresa"
              description="Faça uma busca ou aumente o raio."
            />
          ) : (
            <Virtuoso
              totalCount={sortedResults.length}
              useWindowScroll={false}
              itemContent={(index) => {
                const r = sortedResults[index];
                return (
                  <div className="px-0.5 py-0.5" data-place-id={r.placeId}>
                    <DiscoveryCard result={r} searchId={currentSearch?.id ?? ""} />
                  </div>
                );
              }}
              style={{ height: `${Math.max(sortedResults.length * 120, 200)}px` }}
            />
          )}
        </div>
      </div>
      {/* fecha o scroll wrapper */}
    </aside>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function SummaryPill({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: "primary";
  icon?: typeof Globe;
}) {
  return (
    <div
      className={cn(
        "rounded-md px-1.5 py-1.5 text-center",
        tone === "primary" ? "bg-primary-soft" : "bg-muted",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-0.5 text-[15px] font-semibold",
          tone === "primary" ? "text-primary" : "text-foreground",
        )}
      >
        {Icon && <Icon className="h-3 w-3 opacity-60" />}
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
