/**
 * Phase 4 — Real search: bridges SearchForm to the SearchRepository.
 *
 * Demo mode: uses the existing mock searchService (keeps progress animation).
 * Real mode: creates a search via Supabase, polls status, and imports results.
 */
import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSearchRepository } from "@/repositories";
import { searchService, type SearchInput } from "@/services";
import { isRealMode } from "@/lib/env";
import type { Lead, Search } from "@/types";
import type { CreateSearchInput, SearchStatusSnapshot } from "@/repositories/types";
import { SEARCH_STEPS } from "@/lib/constants";
import { leadKeys } from "./useLeadsQuery";

export interface SearchProgress {
  step: number;
  stepLabel: string;
  percent: number;
  partialCount: number;
}

interface UseSearchMutationOptions {
  onSuccess: (leads: Lead[], search: Search) => void;
  onError: (message: string) => void;
}

export function useSearchMutation({ onSuccess, onError }: UseSearchMutationOptions) {
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const cancelRef = useRef(false);
  const queryClient = useQueryClient();

  // ── Demo mode: existing mock flow with progress animation ──
  const demoMutation = useMutation({
    mutationFn: (input: SearchInput) => searchService.run(input),
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
      };

      // Step 1: Create the search
      setProgress({ step: 0, stepLabel: "Criando busca...", percent: 5, partialCount: 0 });
      const { searchId } = await repo.create(createInput);
      if (cancelRef.current) return;

      // Step 2: Poll status
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

      do {
        if (cancelRef.current) {
          await repo.cancel(searchId);
          setProgress(null);
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
        status = await repo.getStatus(searchId);

        const label = statusLabels[status.status] ?? status.status;
        const percent = Math.min(
          95,
          status.status === "completed" || status.status === "partial"
            ? 100
            : status.status === "failed"
              ? 0
              : 30 + (status.importedCount / Math.max(status.foundCount, 1)) * 65,
        );

        setProgress({
          step: 0,
          stepLabel: label,
          percent: Math.round(percent),
          partialCount: status.importedCount || status.foundCount || 0,
        });
      } while (!["completed", "partial", "failed", "cancelled"].includes(status.status));

      if (cancelRef.current) return;

      // Step 3: Handle completion
      if (status.status === "failed") {
        setProgress(null);
        onError(status.errorMessage ?? "Falha na busca");
        return;
      }

      // Import all results
      setProgress({
        step: 0,
        stepLabel: "Finalizando...",
        percent: 95,
        partialCount: status.foundCount,
      });
      const importResult = await repo.importResults(searchId, [], true);
      if (cancelRef.current) return;

      // Build search metadata for the store
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
        addedToPipeline: importResult.imported,
        contactsFound: status.enrichedCount,
      };

      setProgress(null);

      // Invalidate leads query to refresh all screens
      queryClient.invalidateQueries({ queryKey: leadKeys.all });

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
