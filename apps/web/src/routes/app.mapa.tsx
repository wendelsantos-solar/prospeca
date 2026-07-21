import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLeadsStore, useLocationStore, useSettingsStore } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { applyFilters, sortLeads } from "@/lib/filters";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HOME_SUGGESTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { MapIcon, Search, Sparkles, Loader2 } from "lucide-react";
import { LocationPrompt } from "@/components/app/LocationPrompt";
import type { SuggestSearchDetail } from "@/components/app/SearchForm";

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
    const detail: SuggestSearchDetail = {
      niche: s.niche,
      location: s.location,
      lat: s.lat,
      lng: s.lng,
      presence: s.presence,
    };
    window.dispatchEvent(new CustomEvent("suggest-search", { detail }));
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
        <Button
          className="gap-2"
          onClick={() => window.dispatchEvent(new CustomEvent("focus-niche"))}
        >
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

  // CRM real — leads now come from TanStack Query (Phase 3)
  const { data } = useLeadsList(filters, sort);
  const allLeads = useMemo(() => data?.items ?? [], [data]);

  const filtered = useMemo(
    () => sortLeads(applyFilters(allLeads, filters), sort),
    [allLeads, filters, sort],
  );

  if (searching && allLeads.length === 0) {
    return <CenteredLoader label="Buscando empresas..." />;
  }

  if (searchError && allLeads.length === 0) {
    return (
      <div className="grid h-full place-items-center">
        <ErrorState
          title="Falha na busca"
          description={searchError}
          onRetry={() => window.dispatchEvent(new CustomEvent("retry-search"))}
          onBack={() => setSearchError(null)}
        />
      </div>
    );
  }

  if (!loaded && allLeads.length === 0) {
    const showPrompt = !lastLocation && !previewLocation && !promptDismissed;
    if (previewLocation || showPrompt) {
      return (
        <div className="relative h-full w-full">
          <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
            <MapView leads={[]} />
          </Suspense>
          {showPrompt && (
            <LocationPrompt
              onDismiss={() => setPromptDismissed(true)}
              onPickCity={() => {
                setPromptDismissed(true);
                window.dispatchEvent(new CustomEvent("focus-niche"));
              }}
            />
          )}
        </div>
      );
    }
    return <HomeState />;
  }

  if (filtered.length === 0) {
    const filtersExcludeAll = allLeads.length > 0;
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          icon={MapIcon}
          title={filtersExcludeAll ? "Nenhum lead com esses filtros" : "Nenhum lead no mapa"}
          description={
            filtersExcludeAll
              ? "Nenhum dos leads carregados passa nos filtros atuais."
              : "Ajuste os filtros ou faça uma nova busca."
          }
          action={
            filtersExcludeAll ? (
              <Button variant="outline" size="sm" onClick={() => clearFilters()}>
                Afrouxar os filtros
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <Suspense fallback={<CenteredLoader label="Carregando o mapa..." />}>
      <MapView leads={filtered} />
    </Suspense>
  );
}
