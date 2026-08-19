import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RotateCcw,
  History,
  Bookmark,
  Flame,
  GlobeLock,
  Star,
  FolderOpen,
  Copy,
  Pencil,
  SquarePen,
} from "lucide-react";
import { getSearchRepository } from "@/repositories";
import { useSearchSession } from "@/stores/searchSession";
import { useSearchDraftStore, useLeadsStore } from "@/stores";
import { queryKeys } from "@/lib/queryKeys";
import { isDemoMode } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { savedSearchToSearch } from "@/lib/saved-search";
import type { SavedSearch } from "@/types";

export const Route = createFileRoute("/app/historico")({
  component: HistoryPage,
});

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icon className="h-3 w-3" />
      {value} {label}
    </span>
  );
}

function HistoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openSearch = useLeadsStore((s) => s.openSearch);

  const {
    data: history,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.searches.list({}),
    queryFn: () => getSearchRepository().listHistory(),
  });

  const savedQuery = useQuery({
    queryKey: ["searches", "saved"],
    queryFn: () => getSearchRepository().listSavedSearches(),
  });

  const unsave = useMutation({
    mutationFn: (searchId: string) => getSearchRepository().unsaveSearch(searchId),
    onSuccess: () => {
      toast.success("Busca desmarcada");
      queryClient.invalidateQueries({ queryKey: ["searches", "saved"] });
    },
    onError: () => toast.error("Não foi possível desmarcar a busca"),
  });

  const rerun = useMutation({
    mutationFn: (search: NonNullable<typeof history>[number]) => {
      useSearchSession.getState().suggestSearch({
        niche: search.niche,
        location: search.location,
        lat: search.latitude,
        lng: search.longitude,
        radiusKm: search.radiusKm,
        presence: search.presence,
      });
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.info("Configuração da busca carregada no formulário.");
      queryClient.invalidateQueries({ queryKey: queryKeys.searches.all });
    },
  });

  const openSaved = (s: SavedSearch) => {
    openSearch(savedSearchToSearch(s));
    navigate({ to: "/app/mapa" });
  };

  /** Duplicar missão (V3-E): nova busca com os MESMOS critérios — uma nova
   * linha em searches, sem duplicar resultados (reusa create-search). */
  const duplicateSaved = async (s: SavedSearch) => {
    try {
      await getSearchRepository().create({
        query: s.query,
        location: { label: s.locationLabel, latitude: s.latitude, longitude: s.longitude },
        radiusMeters: s.radiusMeters,
        presenceFilter: s.presenceFilter,
        maxResults: 25,
      });
      toast.success(
        "Missão duplicada — nova busca iniciada (pode custar ~US$0.03 se não houver cache).",
      );
      navigate({ to: "/app/mapa" });
    } catch {
      toast.error("Não foi possível duplicar a missão.");
    }
  };

  /** Editar critérios (V3-E): prefill do formulário — as buscas são imutáveis
   * por design; editar = preencher e disparar uma nova busca ajustada. */
  const editSaved = (s: SavedSearch) => {
    useSearchDraftStore.getState().setDraft({
      niche: s.query,
      location: s.locationLabel,
      coords: { lat: s.latitude, lng: s.longitude },
      radiusKm: s.radiusMeters / 1000,
      presence:
        s.presenceFilter === "without_website"
          ? "no-website"
          : s.presenceFilter === "with_website"
            ? "with-website"
            : "all",
    });
    toast.info("Critérios carregados no formulário — ajuste e busque.");
    navigate({ to: "/app/mapa" });
  };

  const renameSaved = async (s: SavedSearch) => {
    const name = window.prompt("Nome da missão:", s.savedName ?? "");
    if (name != null && name.trim()) {
      await getSearchRepository().saveSearch(s.searchId, name.trim());
      toast.success("Missão renomeada.");
      savedQuery.refetch();
    }
  };

  const saved = savedQuery.data ?? [];

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Histórico de buscas</h1>
          <p className="text-sm text-muted-foreground">
            Buscas realizadas pela sua organização. Reabrir resultados não gera novas chamadas
            pagas.
          </p>
        </div>

        {/* ── Buscas salvas (missões) ── */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Bookmark className="h-4 w-4 text-primary" />
            Buscas salvas
          </h2>
          {/* LOTE 4B (2º defeito): em demo o "salvo" é memória de módulo, não
           * banco — some no reload, igual todo o resto do estado demo (lead,
           * nota, estágio). Avisar aqui é mais honesto que inventar um banco
           * só para esta lista enquanto o resto do demo continua efêmero. */}
          {isDemoMode && (
            <p className="text-[12px] text-muted-foreground">
              Modo demonstração: missões salvas duram até você recarregar a página.
            </p>
          )}

          {savedQuery.isLoading && <Skeleton className="h-20 w-full" />}
          {savedQuery.error && (
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as buscas salvas.
            </p>
          )}
          {!savedQuery.isLoading && saved.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma missão salva ainda. Faça uma busca e clique no marcador (🔖) no topo para
              salvá-la.
            </p>
          )}

          {saved.map((s) => (
            <Card key={s.searchId} className="border-primary/30">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.savedName || s.query}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.locationLabel} · raio {s.radiusMeters / 1000}km ·{" "}
                    {formatDateTime(s.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Stat icon={Star} label="resultados" value={s.totalResults} />
                    <Stat icon={Flame} label="quentes" value={s.hotCount} />
                    <Stat icon={Star} label="score médio" value={s.avgScore} />
                    <Stat icon={GlobeLock} label="sem site" value={s.withoutWebsite} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="default" size="sm" onClick={() => openSaved(s)}>
                    <FolderOpen className="mr-1 h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateSaved(s)}
                    aria-label="Duplicar missão"
                    title="Duplicar (nova busca com os mesmos critérios)"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => editSaved(s)}
                    aria-label="Editar critérios da missão"
                    title="Editar critérios (preenche o formulário)"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => renameSaved(s)}
                    aria-label="Renomear missão"
                    title="Renomear"
                  >
                    <SquarePen className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => unsave.mutate(s.searchId)}
                    aria-label="Desmarcar busca salva"
                    title="Desmarcar"
                    disabled={unsave.isPending}
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Histórico completo ── */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            Todas as buscas
          </h2>

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {error && (
            <ErrorState
              title="Falha ao carregar o histórico"
              description="Não foi possível carregar o histórico. Verifique sua conexão."
              onRetry={() => refetch()}
            />
          )}

          {history && history.length === 0 && (
            <EmptyState
              icon={History}
              title="Nenhuma busca ainda"
              description="Realize sua primeira busca para ver o histórico aqui."
            />
          )}

          {history?.map((search) => (
            <Card key={search.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{search.niche}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {search.location} · raio {search.radiusKm}km ·{" "}
                    {formatDateTime(search.createdAt)}
                  </p>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="secondary">{search.totalFound} encontrados</Badge>
                    <Badge variant="secondary">{search.addedToPipeline} importados</Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rerun.mutate(search)}
                  aria-label="Repetir configuração"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  Repetir
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
