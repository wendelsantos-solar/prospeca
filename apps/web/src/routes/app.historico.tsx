import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, History } from "lucide-react";
import { getSearchRepository } from "@/repositories";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/app/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const {
    data: history,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.searches.list({}),
    queryFn: () => getSearchRepository().listHistory(),
  });

  const rerun = useMutation({
    mutationFn: (search: NonNullable<typeof history>[number]) =>
      Promise.resolve(
        window.dispatchEvent(
          new CustomEvent("suggest-search", {
            detail: {
              niche: search.niche,
              location: search.location,
              latitude: search.latitude,
              longitude: search.longitude,
              radiusKm: search.radiusKm,
              presence: search.presence,
            },
          }),
        ),
      ),
    onSuccess: () => {
      toast.info("Configuração da busca carregada no formulário.");
      queryClient.invalidateQueries({ queryKey: queryKeys.searches.all });
    },
  });

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Histórico de buscas</h1>
          <p className="text-sm text-muted-foreground">
            Buscas realizadas pela sua organização. Reabrir resultados não gera novas chamadas
            pagas.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Falha ao carregar o histórico. Tente novamente.
          </p>
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
                  {search.location} · raio {search.radiusKm}km · {formatDateTime(search.createdAt)}
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
      </div>
    </div>
  );
}
