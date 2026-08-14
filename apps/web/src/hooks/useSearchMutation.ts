/**
 * Phase 4 — Real search: bridges SearchForm to the SearchRepository.
 *
 * Demo mode: uses the existing mock searchService (keeps progress animation).
 * Real mode: creates a search via Supabase, polls status, and imports results.
 */
import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSearchRepository } from "@/repositories";
import { getSupabase } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";
import type { Lead, Search } from "@/types";
import type { CreateSearchInput, SearchStatusSnapshot } from "@/repositories/types";
import { SEARCH_STEPS } from "@/lib/constants";

// SearchInput type is shared between demo/real — lightweight, no runtime cost.
export type { SearchInput } from "@/services";
import type { SearchInput } from "@/services";

export interface SearchProgress {
  step: number;
  stepLabel: string;
  percent: number;
  partialCount: number;
  /** Pre-flight estimate from create-search (range, honest — never exact). */
  estimate?: {
    costUsdMin: number;
    costUsdMax: number;
    resultsMin: number;
    resultsMax: number;
  } | null;
}

interface UseSearchMutationOptions {
  onSuccess: (leads: Lead[], search: Search) => void;
  onError: (message: string) => void;
}

export function useSearchMutation({ onSuccess, onError }: UseSearchMutationOptions) {
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const cancelRef = useRef(false);
  const queryClient = useQueryClient();

  // ── Demo mode: mock flow with progress animation ──
  const demoMutation = useMutation({
    mutationFn: async (input: SearchInput) => {
      const { searchService } = await import("@/services");
      return searchService.run(input);
    },
    onSuccess: ({ leads, search }) => {
      setProgress(null);
      onSuccess(leads, search);
    },
    onError: (e) => {
      setProgress(null);
      onError(e instanceof Error ? e.message : "Falha na busca");
    },
  });

  // ── Real mode: repository-based with status polling ──
  const runRealSearch = useCallback(
    async (input: SearchInput) => {
      cancelRef.current = false;
      const repo = getSearchRepository();

      // Map SearchInput → CreateSearchInput
      const createInput: CreateSearchInput = {
        query: input.niche,
        location: {
          label: input.location,
          latitude: input.latitude,
          longitude: input.longitude,
        },
        radiusMeters: input.radiusKm * 1000,
        presenceFilter:
          input.presence === "no-website"
            ? "without_website"
            : input.presence === "with-website"
              ? "with_website"
              : "all",
        maxResults: input.maxResults,
        forceRefresh: input.forceRefresh,
      };

      // Step 1: Create the search
      setProgress({ step: 0, stepLabel: "Criando busca...", percent: 5, partialCount: 0 });
      const created = await repo.create(createInput);
      const { searchId } = created;
      if (created.estimate) {
        setProgress((p) =>
          p
            ? {
                ...p,
                estimate: {
                  costUsdMin: created.estimate!.costUsdMin,
                  costUsdMax: created.estimate!.costUsdMax,
                  resultsMin: created.estimate!.resultsMin,
                  resultsMax: created.estimate!.resultsMax,
                },
              }
            : p,
        );
      }
      if (cancelRef.current) return;

      // Step 2: aguarda conclusão. Realtime empurra o UPDATE de `searches` na
      // hora — numa busca com cache hit (execute-search ~300ms) o "completed"
      // chega quase instantâneo, em vez de esperar o próximo poll. O polling
      // lento (1200ms) fica só como rede de segurança se o Realtime cair.
      let status: SearchStatusSnapshot;
      const statusLabels: Record<string, string> = {
        queued: "Na fila...",
        geocoding: "Geocodificando localização...",
        searching: "Buscando empresas...",
        importing: "Importando resultados...",
        enriching: "Enriquecendo dados...",
        completed: "Concluído!",
        partial: "Parcialmente concluído",
        failed: "Falha na busca",
        cancelled: "Cancelado",
      };
      const isTerminal = (s: string) => ["completed", "partial", "failed", "cancelled"].includes(s);
      const report = (s: SearchStatusSnapshot) => {
        const percent = Math.min(
          95,
          s.status === "completed" || s.status === "partial"
            ? 100
            : s.status === "failed"
              ? 0
              : 30 + (s.importedCount / Math.max(s.foundCount, 1)) * 65,
        );
        setProgress({
          step: 0,
          stepLabel: statusLabels[s.status] ?? s.status,
          percent: Math.round(percent),
          partialCount: s.importedCount || s.foundCount || 0,
        });
      };

      // Realtime channel: any UPDATE on this search row wakes the wait early.
      const supabase = getSupabase();
      let wake: (() => void) | null = null;
      const channel = supabase
        .channel(`search-${searchId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "searches", filter: `id=eq.${searchId}` },
          () => wake?.(),
        )
        .subscribe();
      const waitTick = () =>
        new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 1200);
          wake = () => {
            clearTimeout(t);
            wake = null;
            resolve();
          };
        });

      try {
        // Immediate check first: a cache hit may already be done before we even
        // subscribe, so don't pay a full tick waiting for an event that passed.
        status = await repo.getStatus(searchId);
        report(status);
        while (!isTerminal(status.status)) {
          if (cancelRef.current) {
            await repo.cancel(searchId);
            setProgress(null);
            return;
          }
          await waitTick();
          status = await repo.getStatus(searchId);
          report(status);
        }
      } finally {
        supabase.removeChannel(channel);
      }

      if (cancelRef.current) return;

      // Step 3: Handle completion
      if (status.status === "failed") {
        setProgress(null);
        onError(status.errorMessage ?? "Falha na busca");
        return;
      }

      setProgress({
        step: 0,
        stepLabel: "Finalizando...",
        percent: 95,
        partialCount: status.foundCount,
      });
      if (cancelRef.current) return;

      // Build search metadata for the store. Discovery does NOT materialize
      // leads; the funnel is populated by explicit user action, so nothing is
      // auto-added to the pipeline here.
      const searchMeta: Search = {
        id: searchId,
        niche: input.niche,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusKm: input.radiusKm,
        presence: input.presence,
        createdAt: new Date().toISOString(),
        totalFound: status.foundCount,
        enrichedCount: status.enrichedCount,
        addedToPipeline: 0,
        contactsFound: status.enrichedCount,
        estimatedCostUsd: status.estimatedCostUsd ?? null,
        estimatedResults: status.estimatedResults ?? null,
      };

      setProgress(null);

      // Refresh discovery + CRM list views.
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      queryClient.invalidateQueries({ queryKey: ["discovery"] });

      // Phase 2: discovery contact enrichment (top-N by score, best-effort).
      // Fire-and-forget — refresh discovery once it finishes so the newly
      // scraped contacts + re-scored temperatures appear on the map/list.
      repo
        .enrichDiscovery(searchId)
        .then(() => queryClient.invalidateQueries({ queryKey: ["discovery"] }))
        .catch(() => {});

      // For backward compat, also populate store
      // (leads will be fetched fresh by query hooks on next render)
      onSuccess([], searchMeta);
    },
    [onSuccess, onError, queryClient],
  );

  const realMutation = useMutation({
    mutationFn: (input: SearchInput) => runRealSearch(input),
    onError: (e) => {
      setProgress(null);
      onError(e instanceof Error ? e.message : "Falha na busca");
    },
  });

  const run = useCallback(
    (input: SearchInput) => {
      cancelRef.current = false;
      if (isRealMode) {
        realMutation.mutate(input);
      } else {
        // Demo mode: simulate progress steps then run mock search
        const total = SEARCH_STEPS.length;

        async function simulateSteps() {
          for (let i = 0; i < total; i++) {
            if (cancelRef.current) {
              setProgress(null);
              return;
            }
            setProgress({
              step: i,
              stepLabel: SEARCH_STEPS[i],
              percent: Math.round(((i + 1) / total) * 100),
              partialCount: Math.round(((i + 1) / total) * 30),
            });
            await new Promise((r) => setTimeout(r, 280 + Math.random() * 320));
          }
          if (!cancelRef.current) {
            demoMutation.mutate(input);
          } else {
            setProgress(null);
          }
        }

        simulateSteps();
      }
    },

    [demoMutation, realMutation],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const loading = demoMutation.isPending || realMutation.isPending || progress != null;

  return { run, cancel, loading, progress };
}
