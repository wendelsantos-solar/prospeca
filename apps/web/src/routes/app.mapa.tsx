import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLeadsStore, useLocationStore, useSettingsStore, useSearchDraftStore } from "@/stores";
import { useDiscoveryResults } from "@/hooks/useLeadsQuery";
import { filterByRadius } from "@/lib/filters";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HOME_SUGGESTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MapIcon, Search, Sparkles, Loader2 } from "lucide-react";
import { LocationPrompt } from "@/components/app/LocationPrompt";
import { useSearchSession } from "@/stores/searchSession";

const MapView = lazy(() =>
  import("@/components/app/MapView").then((m) => ({ default: m.MapView })),
);

export const Route = createFileRoute("/app/mapa")({
  component: MapaPage,
  head: () => ({ meta: [{ title: "Mapa — Radar Local" }] }),
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Encontre sua próxima oportunidade local
        </h1>
        <p className="text-sm text-muted-foreground">
          Pesquise empresas por nicho e localização, identifique quem tem baixa presença digital e
          organize os leads em um funil comercial.
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 text-left">
          {[
            "Descoberta e enriquecimento simulado de leads.",
            "Mapa, Kanban e painel sincronizados.",
            "Preparação de mensagens em massa.",
          ].map((b) => (
            <li key={b} className="rounded-lg border bg-surface p-3 text-xs text-muted-foreground">
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
        <Button className="gap-2" onClick={() => useSearchSession.getState().focusNiche()}>
          <Search className="h-4 w-4" />
          Começar uma busca
        </Button>
      </div>
    </div>
  );
}

function MapaPage() {
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
    const outsideRadius = allResults.length > 0;
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          icon={MapIcon}
          title={outsideRadius ? "Nada dentro do raio" : "Nenhum resultado"}
          description={
            outsideRadius
              ? "Nenhuma empresa desta busca está dentro do raio atual. Aumente o raio."
              : "Ajuste a busca e tente novamente."
          }
          action={
            outsideRadius ? (
              <Button variant="outline" size="sm" onClick={() => clearFilters()}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
      <MapView results={resultsInRadius} />
    </Suspense>
  );
}
