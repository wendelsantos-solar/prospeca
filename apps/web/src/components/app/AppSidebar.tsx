import { useMemo, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { useUIStore, useLeadsStore, useSearchDraftStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { RADIUS_OPTIONS } from "@/lib/constants";
import { hasAdvancedFilters } from "@/lib/filters";
import { SearchForm } from "./SearchForm";
import { DiscoveryCard } from "./DiscoveryCard";
import { useFilteredResults } from "./AdvancedFiltersPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LeadListSkeleton } from "@/components/shared/Skeletons";
import { filterByRadius } from "@/lib/filters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SortBy = "score" | "distance" | "rating" | "reviews";

/** Ordenações reais sobre DiscoveryResult — espelham sortLeads (lib/filters):
 * "Melhor oportunidade" = score-desc; as demais correspondem a
 * distance-asc / rating-desc / reviews-desc. */
const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "score", label: "Melhor oportunidade" },
  { value: "distance", label: "Mais próximo" },
  { value: "rating", label: "Melhor avaliação" },
  { value: "reviews", label: "Mais avaliações" },
];

/** "Ver mais resultados" sobe o teto de maxResults e re-roda a MESMA busca
 * (cache hit no provider real). Google Text Search limita ~60 por busca. */
const RESULT_COUNTS = [10, 25, 50, 100] as const;

export function AppSidebar({ mobile }: { mobile?: boolean }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const density = useUIStore((s) => s.density);
  const advancedFilters = useUIStore((s) => s.advancedFilters);
  const filtersActive = hasAdvancedFilters(advancedFilters);

  const searching = useLeadsStore((s) => s.searching);
  const searchError = useLeadsStore((s) => s.searchError);
  const setSearchError = useLeadsStore((s) => s.setSearchError);
  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const maxResults = useSearchDraftStore((s) => s.draft.maxResults) ?? 25;
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

  // Filtros locais + avançados (F3) — a MESMA função que o mapa usa, para que
  // lista e mapa sempre concordem sobre o conjunto visível.
  const filteredResults = useFilteredResults(resultsInRadius);

  const sortedResults = useMemo(() => {
    const arr = [...filteredResults];
    if (sortBy === "score") arr.sort((a, b) => b.score - a.score);
    if (sortBy === "distance") arr.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sortBy === "rating") arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sortBy === "reviews") arr.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    return arr;
  }, [filteredResults, sortBy]);

  // "Ver mais resultados": só aparece quando o retorno ALCANÇOU o teto pedido
  // (pode haver mais) e ainda existe um teto maior.
  const nextTier = RESULT_COUNTS.find((n) => n > maxResults);
  const canLoadMore = nextTier != null && discovery != null && discovery.length >= maxResults;

  const loadMore = () => {
    if (!nextTier) return;
    setDraft({ maxResults: nextTier });
    useSearchSession.getState().retrySearch();
  };

  // Colapsada = tira de ~48px com o botão de expandir SEMPRE visível (REGRA
  // DURA: nunca esconder sem forma óbvia de restaurar). O mesmo toggle vive
  // no TopNav (PanelLeftOpen); a tira garante affordance mesmo que o header
  // mude. Em mobile o painel vive num Sheet e nunca colapsa.
  if (collapsed && !mobile) {
    return (
      <aside
        aria-label="Painel de descoberta recolhido"
        className="hidden w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 lg:flex"
      >
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Mostrar painel de descoberta"
          title="Mostrar painel de descoberta"
          aria-expanded="false"
        >
          <AppIcon icon={icons.layout.expandSidebar} size="md" tone="inherit" decorative />
        </button>
        <Search className="mt-2 h-4 w-4 text-muted-foreground/60" aria-hidden />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar",
        mobile ? "h-full w-full" : "hidden lg:flex w-full max-w-[290px] shrink-0 border-r",
      )}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight tracking-tight">
            Descobrir oportunidades
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            Encontre empresas locais com baixa presença digital
          </div>
        </div>
      </div>

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* Search block */}
        <div className="border-b border-sidebar-border p-4">
          <SearchForm />
        </div>

        {/* Contagem + ordenação + export — uma linha, como o mockup */}
        {!searching && !searchError && resultsInRadius.length > 0 && (
          <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-2">
            <span className="min-w-0 truncate text-[12px] font-medium text-foreground">
              {sortedResults.length} empresas encontradas
              {filtersActive && (
                <span className="text-muted-foreground"> de {resultsInRadius.length}</span>
              )}
            </span>
            <label className="ml-auto flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <span className="hidden sm:inline">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Ordenar resultados"
                className="h-7 max-w-[140px] rounded-md border border-border bg-surface px-1.5 text-[11.5px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
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
              onRetry={() => useSearchSession.getState().retrySearch()}
              onSecondary={
                isAreaTooLargeError && smallerRadius
                  ? () => {
                      setDraft({ radiusKm: smallerRadius });
                      useSearchSession.getState().retrySearch();
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
          ) : sortedResults.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Filtros removeram tudo"
              description="Nenhuma empresa do resultado carregado passa pelos filtros locais."
            />
          ) : (
            <>
              {/* Lista simples mapeada — SEM virtualização: o provider limita
               * ~60 resultados por busca, e um Virtuoso com altura fixa
               * (todos os itens renderizados) além de não virtualizar nada,
               * quebrava em branco quando totalCount ia 2→0→2 numa re-busca
               * (P2-1 do gate: contador renderizava e a lista não). */}
              {sortedResults.map((r) => (
                <div key={r.placeId} className="px-0.5 py-0.5" data-place-id={r.placeId}>
                  <DiscoveryCard result={r} searchId={currentSearch?.id ?? ""} />
                </div>
              ))}
              {canLoadMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  className="mx-auto mt-2 block text-[12px] font-medium text-primary hover:underline"
                >
                  Ver mais resultados (~{nextTier})
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {/* fecha o scroll wrapper */}
    </aside>
  );
}
