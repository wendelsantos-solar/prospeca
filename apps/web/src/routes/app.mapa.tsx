import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  useLeadsStore,
  useLocationStore,
  useSettingsStore,
  useSearchDraftStore,
  useUIStore,
} from "@/stores";
import { useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { filterByRadius } from "@/lib/filters";
import { sortDiscoveryResults } from "@/lib/discovery-sort";
import { radiusToReach, nearestOutsideDescription } from "@/lib/nearest-outside";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HOME_SUGGESTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapIcon, Search, Sparkles, Loader2, Bookmark, X } from "lucide-react";
import { getSearchRepository } from "@/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/env";
import { toast } from "sonner";
import { LocationPrompt } from "@/components/app/LocationPrompt";
import { useSearchSession } from "@/stores/searchSession";
import { ResultsList } from "@/components/app/ResultsList";
import { DiscoveryKpis } from "@/components/app/DiscoveryKpis";
import { computeDiscoveryKpis } from "@/lib/discovery-kpis";
import { AdvancedFiltersPanel, useFilteredResults } from "@/components/app/AdvancedFiltersPanel";
import { CompanyDetailPanel } from "@/components/app/CompanyDetailPanel";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDirty } from "@/hooks/useIsDirty";
import { searchHereAt, isSignificantPan } from "@/hooks/useSearchHere";

const MapView = lazy(() =>
  import("@/components/app/MapView").then((m) => ({ default: m.MapView })),
);

export const Route = createFileRoute("/app/mapa")({
  component: MapaPage,
  head: () => ({ meta: [{ title: "Mapa — Prospeca" }] }),
});

function CenteredLoader({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex items-center gap-2 rounded-lg border bg-surface px-4 py-3 shadow-elevated text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        {label}
      </div>
    </div>
  );
}

function HomeState() {
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const startSearch = () => {
    // A busca vive no AppSidebar — se estiver colapsado, "Começar uma busca"
    // abriria um combobox invisível. Garante o sidebar aberto antes de focar.
    setSidebarCollapsed(false);
    useSearchSession.getState().focusNiche();
  };
  const suggest = (s: (typeof HOME_SUGGESTIONS)[number]) => {
    useSearchSession.getState().suggestSearch({
      niche: s.niche,
      location: s.location,
      lat: s.lat,
      lng: s.lng,
      presence: s.presence,
    });
  };
  return (
    <div className="flex h-full items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-lg text-center space-y-4">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/50 text-primary-foreground shadow-elevated">
          <MapIcon className="h-7 w-7" />
        </div>
        {/* FASE C: alinhado à promessa da landing ("Encontre quem abordar
         * primeiro e por quê") — antes vendia busca geográfica, e o produto
         * responde priorização + explicação (score em anel, decisor,
         * presença digital, reputação), não "onde estão". */}
        <h1 className="text-2xl font-semibold tracking-tight">Quem abordar primeiro, e por quê</h1>
        <p className="text-sm text-muted-foreground">
          Pesquise empresas por nicho e região. Cada uma chega com um score de oportunidade e o
          motivo — presença digital, decisor identificado, reputação — para você priorizar o próximo
          contato.
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-left">
          {[
            "Descoberta e enriquecimento automático de leads.",
            "Mapa, Kanban e painel sincronizados.",
            "Preparação de mensagens em massa.",
          ].map((b) => (
            <li
              key={b}
              className="rounded-lg border bg-surface p-3 text-caption text-muted-foreground"
            >
              {b}
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Sugestões de busca
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {HOME_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => suggest(s)}
                className="rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Button className="gap-2" onClick={startSearch}>
          <Search className="h-4 w-4" />
          Começar uma busca
        </Button>
      </div>
    </div>
  );
}

/**
 * Grid da descoberta (Fase 2): | Nav | Descoberta | Mapa | Detalhe |.
 * O mapa é o protagonista (flex-1, min-w-0); o painel de detalhe só existe
 * quando há empresa selecionada — fechado, o mapa recupera o espaço.
 */
function MapaPage() {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <MapaWorkspace />
      </div>
      <CompanyDetailPanel />
    </div>
  );
}

/** Barra do topo do mapa (Fase 90): DUAS linhas distintas como o mockup —
 * linha 1 = KPI bar; linha 2 = tabs pill segmentado + métrica do heatmap +
 * filtros com badge. (Na F4 juntamos; o mockup separa — decisão do Maestro.) */
function MapToolbar({
  kpis,
  estimate,
}: {
  kpis: ReturnType<typeof computeDiscoveryKpis>;
  estimate: { costUsdMax: number; resultsMax: number } | null;
}) {
  const discoveryView = useUIStore((s) => s.discoveryView);
  const setDiscoveryView = useUIStore((s) => s.setDiscoveryView);
  const heatMetric = useUIStore((s) => s.heatMetric);
  const setHeatMetric = useUIStore((s) => s.setHeatMetric);
  // 'Buscar nesta área' na BARRA (mockup) — a regra dura não mudou: o pan só
  // atualiza o centro no store; a busca roda SÓ no clique deste botão.
  const mapViewport = useUIStore((s) => s.mapViewport);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const searching = useLeadsStore((s) => s.searching);
  const draft = useSearchDraftStore((s) => s.draft);
  const { dirty, reason } = useIsDirty();
  const significant = isSignificantPan(mapViewport);
  const dirtyOk = dirty && !(reason === "niche" && draft.niche.trim().length < 2);
  const showSearchHere = !!currentSearch && !searching && (significant || dirtyOk);

  // "Salvar busca como missão" (LOTE 2, Tarefa 3 / achado F5): vivia no
  // TopNav, mas TopNav some inteiro em /app/mapa — o botão nunca renderizava.
  // Reusa a MESMA chamada de repositório do "Salvar busca" do SearchForm
  // (AppSidebar), só que como input inline aqui na barra, sem window.prompt
  // (convenção já adotada no resto do produto — Fase 90).
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const queryClient = useQueryClient();
  const saveMission = async () => {
    if (!currentSearch || !saveName.trim()) return;
    try {
      await getSearchRepository().saveSearch(currentSearch.id, saveName.trim());
      queryClient.invalidateQueries({ queryKey: ["searches", "saved"] });
      // LOTE 4B: a persistência já funcionava — o defeito era propagação. A
      // query de /app/historico (["searches","saved"]) tem staleTime de 5min
      // e refetchOnWindowFocus:false (router.tsx); sem isto, quem visitou o
      // histórico antes recebe o CACHE VAZIO por até 5 minutos depois de
      // salvar, mesmo com o dado já persistido. Mesma chave que unsaveSearch
      // já invalida em app.historico.tsx — só faltava aqui.
      // LOTE 4B (2º defeito): em modo demo o "salvo" vive em memória do
      // módulo (mesmo padrão de demoLeads/demoSearches) — não há banco por
      // trás. Um reload de página descarta. Inventar persistência real só
      // para missões, deixando lead/nota/estágio do funil ainda efêmeros no
      // mesmo demo, seria uma inconsistência pior que a limitação: a tela
      // diria "salvo" de um jeito e "não salvo" de outro dentro do MESMO
      // modo. A saída honesta é avisar o escopo, não fingir um banco que não
      // existe.
      toast.success("Busca salva como missão", {
        description: isDemoMode
          ? "Modo demonstração: dura até você recarregar a página."
          : undefined,
      });
      setSaveOpen(false);
      setSaveName("");
    } catch {
      toast.error("Não foi possível salvar a busca");
    }
  };

  return (
    <div className="border-b border-border bg-background px-4 py-2">
      {/* Linha 1 — KPI bar */}
      <DiscoveryKpis kpis={kpis} estimate={estimate} />

      {/* Linha 2 — tabs + métrica + filtros */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div
          className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="Alternar visualização"
        >
          {(
            [
              { v: "map", label: "Mapa", icon: icons.navigation.map },
              { v: "list", label: "Lista", icon: icons.layout.list },
              { v: "heatmap", label: "Heatmap", flame: true },
            ] as const
          ).map((o) => {
            const active = discoveryView === o.v;
            return (
              <button
                key={o.v}
                onClick={() => setDiscoveryView(o.v)}
                aria-pressed={active}
                aria-label={o.label}
                title={o.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                  active
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.v === "heatmap" ? (
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                ) : (
                  <AppIcon icon={o.icon} size="sm" tone="inherit" decorative />
                )}
                <span className="hidden md:inline">{o.label}</span>
              </button>
            );
          })}
        </div>
        {discoveryView === "heatmap" && (
          <select
            value={heatMetric}
            onChange={(e) =>
              setHeatMetric(
                e.target.value as
                  | "opportunity"
                  | "density"
                  | "weak_digital"
                  | "segment_concentration",
              )
            }
            className="h-8 rounded-md border border-border bg-surface px-2 text-[12px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
            aria-label="Métrica do heatmap"
          >
            <option value="opportunity">Oportunidade</option>
            <option value="density">Densidade</option>
            <option value="weak_digital">Presença digital fraca</option>
            <option value="segment_concentration">Concentração de segmento</option>
          </select>
        )}
        <AdvancedFiltersPanel />
        {currentSearch &&
          (saveOpen ? (
            <div className="ml-auto flex items-center gap-1.5">
              <Input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nome para salvar a missão"
                aria-label="Nome para salvar a busca"
                className="h-8 w-40 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveMission();
                  if (e.key === "Escape") setSaveOpen(false);
                }}
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!saveName.trim()}
                onClick={() => void saveMission()}
              >
                Salvar
              </Button>
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                aria-label="Cancelar salvamento"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSaveName(currentSearch.niche || "Missão sem nome");
                setSaveOpen(true);
              }}
              title="Salvar busca como missão"
              aria-label="Salvar busca como missão"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:border-border-strong",
                !showSearchHere && "ml-auto",
              )}
            >
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
              Salvar missão
            </button>
          ))}
        {showSearchHere && (
          <button
            type="button"
            onClick={() => {
              if (significant && mapViewport) void searchHereAt(mapViewport);
              else useSearchSession.getState().radarSearch();
            }}
            title="Busca no Google sob demanda (paga) — nunca dispara sozinha ao mover o mapa"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:border-border-strong"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            Buscar nesta área
            <span className="text-[10.5px] text-muted-foreground">
              {significant ? "área movida" : "atualizar"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function MapaWorkspace() {
  const filters = useLeadsStore((s) => s.filters);
  const sort = useLeadsStore((s) => s.sort);
  const loaded = useLeadsStore((s) => s.loaded);
  const searching = useLeadsStore((s) => s.searching);
  const searchError = useLeadsStore((s) => s.searchError);
  const setSearchError = useLeadsStore((s) => s.setSearchError);
  const previewLocation = useLeadsStore((s) => s.previewLocation);
  const setPreviewLocation = useLeadsStore((s) => s.setPreviewLocation);
  const clearFilters = useLeadsStore((s) => s.clearFilters);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const discoveryView = useUIStore((s) => s.discoveryView);
  const lastLocation = useLocationStore((s) => s.lastLocation);
  const defaultRadius = useSettingsStore((s) => s.defaultRadius);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // On mount: hydrate preview from saved location (returning user); otherwise the
  // prompt card will be shown.
  useEffect(() => {
    const s = useLeadsStore.getState();
    if (s.loaded || s.previewLocation) return;
    if (lastLocation) {
      setPreviewLocation({
        lat: lastLocation.lat,
        lng: lastLocation.lng,
        radiusKm: defaultRadius,
        label: lastLocation.label,
      });
    }
  }, [lastLocation, setPreviewLocation, defaultRadius]);

  // Discovery: results of the current search (search_results ⋈ places), never
  // the org's accumulated leads. Ordered by score in the RPC.
  const { data: discovery } = useDiscoveryResults(currentSearch?.id);
  const allResults = useMemo(() => discovery ?? [], [discovery]);
  const kpis = useMemo(() => computeDiscoveryKpis(allResults), [allResults]);

  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const draftCoords = useSearchDraftStore((s) => s.draft.coords);
  // Radius is a hard filter: center comes from the committed search, not
  // draftCoords (which also tracks map pan/zoom and would empty the map on a pan).
  const radiusCenter = currentSearch
    ? { lat: currentSearch.latitude, lng: currentSearch.longitude }
    : draftCoords;
  const resultsInRadius = useMemo(
    () => filterByRadius(allResults, radiusCenter, radiusKm),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on lat/lng primitives to avoid object-ref churn
    [allResults, radiusCenter.lat, radiusCenter.lng, radiusKm],
  );
  // Advanced filters (V3-A) apply on top of the hard radius filter — map,
  // list and territories always agree on the visible set.
  const filteredResults = useFilteredResults(resultsInRadius);
  // FASE C2: mesma ordenação e mesma fonte (useUIStore.resultSortBy) que o
  // painel (AppSidebar) usa — a lista principal e o painel mostravam a MESMA
  // busca em ordens diferentes porque cada um ordenava por conta própria (ou,
  // como aqui, não ordenava nada). Se o seletor do painel mudar, esta lista
  // muda junto — não há um segundo lugar para esquecer de atualizar.
  const resultSortBy = useUIStore((s) => s.resultSortBy);
  const sortedResults = useMemo(
    () => sortDiscoveryResults(filteredResults, resultSortBy),
    [filteredResults, resultSortBy],
  );

  if (searching && allResults.length === 0) {
    return <CenteredLoader label="Buscando empresas..." />;
  }

  if (searchError && allResults.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <ErrorState
          title="Falha na busca"
          description={searchError}
          onRetry={() => useSearchSession.getState().retrySearch()}
          onBack={() => setSearchError(null)}
        />
      </div>
    );
  }

  if (!loaded && allResults.length === 0) {
    const showPrompt = !lastLocation && !previewLocation && !promptDismissed;
    if (previewLocation || showPrompt) {
      return (
        <div className="relative h-full w-full">
          <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
            <MapView results={[]} />
          </Suspense>
          {showPrompt && (
            <LocationPrompt
              onDismiss={() => setPromptDismissed(true)}
              onPickCity={() => {
                setPromptDismissed(true);
                useSearchSession.getState().focusNiche();
              }}
            />
          )}
        </div>
      );
    }
    return <HomeState />;
  }

  if (resultsInRadius.length === 0) {
    // O que explica o vazio agora é a mais próxima FORA do raio (campo separado
    // da busca), não a presença de resultados fora do raio na lista — o serviço
    // não devolve mais esses registros.
    const nearest = currentSearch?.nearestOutsideRadius ?? null;
    const expandTo = nearest ? radiusToReach(nearest.distanceKm) : null;
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          icon={MapIcon}
          title={
            nearest
              ? `Nenhuma empresa dentro de ${radiusKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`
              : "Nenhum resultado"
          }
          description={
            nearest ? nearestOutsideDescription(nearest) : "Ajuste a busca e tente novamente."
          }
          action={
            nearest ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {expandTo != null && (
                  <Button
                    size="sm"
                    onClick={() => {
                      // Atualiza o controle de raio (slider) E refaz a busca:
                      // o valor visível não pode divergir do valor usado.
                      useSearchDraftStore.getState().setDraft({ radiusKm: expandTo });
                      useSearchSession.getState().retrySearch();
                    }}
                  >
                    Buscar num raio de {expandTo} km
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => clearFilters()}>
                  Limpar filtros
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>
    );
  }

  if (discoveryView === "list" && currentSearch) {
    return (
      <div className="flex h-full flex-col">
        <h1 className="sr-only">Mapa de oportunidades</h1>
        <MapToolbar
          kpis={kpis}
          estimate={
            currentSearch?.estimatedCostUsd != null
              ? {
                  costUsdMax: currentSearch.estimatedCostUsd,
                  resultsMax: currentSearch.estimatedResults ?? 0,
                }
              : null
          }
        />
        <div className="min-h-0 flex-1">
          <ResultsList results={sortedResults} searchId={currentSearch.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">Mapa de oportunidades</h1>
      <MapToolbar
        kpis={kpis}
        estimate={
          currentSearch?.estimatedCostUsd != null
            ? {
                costUsdMax: currentSearch.estimatedCostUsd,
                resultsMax: currentSearch.estimatedResults ?? 0,
              }
            : null
        }
      />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
          <MapView
            results={sortedResults}
            mode={discoveryView === "heatmap" ? "heatmap" : "markers"}
          />
        </Suspense>
      </div>
    </div>
  );
}
