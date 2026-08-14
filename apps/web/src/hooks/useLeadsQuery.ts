/**
 * TanStack Query hooks for Lead CRUD operations.
 * Replaces Zustand useLeadsStore data operations (not UI state).
 *
 * Phase 3 — CRM real: Kanban, list, notes, activities, details.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getLeadRepository, getSearchRepository } from "@/repositories";
import type {
  Lead,
  LeadActivity,
  LeadFilters,
  CreateLeadNoteInput,
  CreateLeadActivityInput,
  RecordContactInput,
} from "@/types";
import type {
  MoveLeadInput,
  PaginatedResult,
  DiscoveryResult,
  PersistedOpportunityScore,
  MissionJobRow,
  MissionSourceRow,
} from "@/repositories/types";
import type { SortValue } from "@/lib/constants";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

// ── Query keys ──────────────────────────────────────────────

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters: LeadFilters, sort?: SortValue) => ["leads", "list", filters, sort] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
};

export const discoveryKeys = {
  bySearch: (searchId: string) => ["discovery", searchId] as const,
};

export const suppressionKeys = { all: ["suppression"] as const };

// ── Business registry (CNPJ) — Fase 5 ────────────────────────────────

export const businessRegistrationKeys = {
  byPlace: (placeId: string) => ["business-registration", placeId] as const,
};

/** Registration fields persisted on the place by lookup-cnpj (RLS read). */
export interface BusinessRegistrationRow {
  tax_id: string | null;
  legal_name: string | null;
  primary_cnae: string | null;
  cnae_description: string | null;
  registration_status: string | null;
  registration_status_description: string | null;
  registration_fetched_at: string | null;
  enrichment_sources: unknown;
}

export function useBusinessRegistration(placeId?: string | null) {
  return useQuery<BusinessRegistrationRow | null>({
    queryKey: businessRegistrationKeys.byPlace(placeId ?? "none"),
    queryFn: async () => {
      if (!placeId) return null;
      const { data, error } = await getSupabase()
        .from("places")
        .select(
          "tax_id, legal_name, primary_cnae, cnae_description, registration_status, registration_status_description, registration_fetched_at, enrichment_sources",
        )
        .eq("id", placeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as BusinessRegistrationRow | null) ?? null;
    },
    enabled: !!placeId,
    staleTime: 5 * 60_000,
  });
}

export function useCnpjLookupMutation(placeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cnpj: string) =>
      invokeFunction<{ found: boolean; reason?: string }>("lookup-cnpj", { placeId, cnpj }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: businessRegistrationKeys.byPlace(placeId) }),
  });
}

/** LGPD opt-out: the org's suppressed contact hashes as a Set for O(1) lookup. */
export function useSuppressionHashes() {
  return useQuery<Set<string>>({
    queryKey: suppressionKeys.all,
    queryFn: async () => new Set(await getLeadRepository().listSuppressionHashes()),
    staleTime: 60_000,
  });
}

export function useSuppressMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: { type: string; value_hash: string; reason?: string }[]) =>
      getLeadRepository().addSuppression(entries),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suppressionKeys.all }),
  });
}

// ── Queries ─────────────────────────────────────────────────

/** CRM leads (Kanban pipeline, Painel metrics). Cumulative across all searches —
 * a lead only exists once the user added the business to the funnel. Discovery
 * (map + sidebar) does NOT use this; it uses useDiscoveryResults.
 *
 * Default page size is 50 (was 500). Pass { page, pageSize } to paginate. */
export function useLeadsList(
  filters: LeadFilters,
  sort?: SortValue,
  opts?: { page?: number; pageSize?: number; enabled?: boolean },
) {
  return useQuery<PaginatedResult<Lead>>({
    queryKey: leadKeys.list(filters, sort),
    queryFn: () =>
      getLeadRepository().list({ filters, sort, page: opts?.page, pageSize: opts?.pageSize ?? 50 }),
    staleTime: 60_000,
    structuralSharing: true,
    enabled: opts?.enabled ?? true,
  });
}

/** Discovery results for a search (map + sidebar list). Reads search_results ⋈
 * places via RPC; never creates leads.
 *
 * structuralSharing keeps the same object references when data hasn't changed,
 * preventing unnecessary re-renders on the map (GoogleMapView/LeafletMapView)
 * and the sidebar list (Virtuoso) when the discovery refetches after enrichment
 * or add-to-funnel invalidations. */
export function useDiscoveryResults(searchId?: string) {
  return useQuery<DiscoveryResult[]>({
    queryKey: searchId ? discoveryKeys.bySearch(searchId) : ["discovery", "none"],
    queryFn: () => (searchId ? getSearchRepository().getDiscovery(searchId) : Promise.resolve([])),
    enabled: !!searchId,
    staleTime: 60_000,
    structuralSharing: true,
  });
}

/** Real pipeline data for a mission (V3-B) — jobs + per-place source states,
 * read under RLS. Empty until the worker has run (UI shows "aguardando"). */
export function useMissionPipeline(searchId?: string | null) {
  return useQuery<{ jobs: MissionJobRow[]; sources: MissionSourceRow[] }>({
    queryKey: ["mission-pipeline", searchId ?? "none"],
    queryFn: () =>
      searchId
        ? getSearchRepository().getMissionPipeline(searchId)
        : Promise.resolve({ jobs: [], sources: [] }),
    enabled: !!searchId,
    staleTime: 15_000,
    refetchInterval: 10_000, // worker lands results in seconds — poll lightly
  });
}

/** Persisted V2 opportunity score for one place (RLS). Null while not yet
 * computed — CompanyIntelligenceCard falls back to the client-side calc. */
export function useOpportunityScore(placeId?: string | null) {
  return useQuery<PersistedOpportunityScore | null>({
    queryKey: ["opportunity-score", placeId ?? "none"],
    queryFn: () =>
      placeId ? getSearchRepository().getOpportunityScore(placeId) : Promise.resolve(null),
    enabled: !!placeId,
    staleTime: 5 * 60_000,
  });
}

/** Materialize a discovered business as a lead in the funnel.
 *
 * Optimistic: the discovery result immediately shows "No pipeline" and a
 * provisional lead card is appended to every cached leads-list page so the
 * Kanban responds without waiting for the server round-trip + refetch. */
export function useAddToFunnelMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      searchId,
      placeId,
      stage,
    }: {
      searchId: string;
      placeId: string;
      stage: "new" | "contacted";
    }) => getSearchRepository().addToFunnel(searchId, placeId, stage),
    onMutate: async ({ searchId, placeId, stage }) => {
      // Cancel outgoing discovery + list queries so they don't overwrite our
      // optimistic update while the mutation is in-flight.
      await queryClient.cancelQueries({ queryKey: discoveryKeys.bySearch(searchId) });
      await queryClient.cancelQueries({ queryKey: ["leads", "list"] });

      // Snapshot previous state for rollback.
      const previousDiscovery = queryClient.getQueryData<DiscoveryResult[]>(
        discoveryKeys.bySearch(searchId),
      );
      const previousLists = queryClient.getQueriesData({ queryKey: ["leads", "list"] });

      // Optimistic: mark discovery item as imported so the button switches to
      // "No pipeline" immediately (no blink waiting for refetch).
      if (previousDiscovery) {
        queryClient.setQueryData<DiscoveryResult[]>(
          discoveryKeys.bySearch(searchId),
          previousDiscovery.map((r) =>
            r.placeId === placeId ? { ...r, importedLeadId: `optimistic-${placeId}` } : r,
          ),
        );
      }

      // Optimistic: append a provisional lead card to every cached list page.
      // The real lead will replace it on the next refetch (onSuccess).
      const optimisticLead = {
        id: `optimistic-${placeId}`,
        companyName: previousDiscovery?.find((r) => r.placeId === placeId)?.name ?? "…",
        stage,
        temperature: "warm" as const,
        score: 50,
        category: "",
        city: "",
        latitude: 0,
        longitude: 0,
        distanceKm: 0,
        hasWebsite: false,
        discoveredAt: new Date().toISOString(),
        notes: [],
        activities: [],
        timeline: [],
      };
      queryClient.setQueriesData({ queryKey: ["leads", "list"] }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const paginated = old as { items?: unknown[] };
        if (!paginated.items) return old;
        return {
          ...paginated,
          items: [optimisticLead, ...paginated.items],
        };
      });

      return { previousDiscovery, previousLists };
    },
    onError: (_err, vars, context) => {
      // Rollback on failure — restore both discovery and list caches.
      if (context?.previousDiscovery) {
        queryClient.setQueryData(discoveryKeys.bySearch(vars.searchId), context.previousDiscovery);
      }
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (_data, _err, vars) => {
      // Always refetch to reconcile optimistic state with server truth.
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      queryClient.invalidateQueries({ queryKey: discoveryKeys.bySearch(vars.searchId) });
    },
    onSuccess: (data, vars) => {
      // Enriquecimento por PLACE (Fase 5): o enriquecimento legado por lead
      // (enrich-lead) foi descontinuado — os leads recém-importados carregam
      // place_id e o fluxo de enriquecimento canônico roda no place (mesma
      // fonte, mesma máquina de estados, proveniência em company_sources).
      // Fire-and-forget sobre a busca; refresca discovery ao terminar.
      if (data.enrichableLeadIds.length > 0) {
        const repo = getSearchRepository();
        repo
          .enrichDiscovery(vars.searchId)
          .then(() =>
            queryClient.invalidateQueries({ queryKey: discoveryKeys.bySearch(vars.searchId) }),
          )
          .catch(() => {});
      }
    },
  });
}

/** On-demand discovery contact enrichment for a single business (lazy, on-open).
 * Best-effort; refreshes discovery so the preview shows the new contact fields. */
export function useEnrichDiscoveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ searchId, placeId }: { searchId: string; placeId: string }) =>
      getSearchRepository().enrichDiscovery(searchId, placeId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.bySearch(vars.searchId) });
    },
  });
}

export function useLeadDetail(id: string | null) {
  return useQuery<Lead | null>({
    queryKey: leadKeys.detail(id ?? ""),
    queryFn: () => getLeadRepository().getById(id!),
    enabled: !!id,
    staleTime: 60_000,
    structuralSharing: true,
  });
}

// ── Mutations ───────────────────────────────────────────────

export function useMoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MoveLeadInput }) =>
      getLeadRepository().moveStage(id, input),
    onMutate: async ({ id, input }) => {
      // Cancel outgoing list queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["leads", "list"] });
      // Snapshot previous list data for rollback
      const previousLists = queryClient.getQueriesData({ queryKey: ["leads", "list"] });
      // Optimistically update the lead in all cached lists
      queryClient.setQueriesData({ queryKey: ["leads", "list"] }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const paginated = old as { items?: Array<{ id: string; stage: string }> };
        if (!paginated.items) return old;
        return {
          ...paginated,
          items: paginated.items.map((item) =>
            item.id === id ? { ...item, stage: input.toStage } : item,
          ),
        };
      });
      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      // Rollback to previous list state on error
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: (_data, vars) => {
      // Only invalidate lists + the moved lead's detail — not every detail cache
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.id) });
    },
  });
}

export function useAddNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: CreateLeadNoteInput }) =>
      getLeadRepository().createNote(leadId, input),
    onMutate: async ({ leadId, input }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.detail(leadId) });
      const previousDetail = queryClient.getQueryData<Lead>(leadKeys.detail(leadId));
      if (previousDetail) {
        const optimisticNote = {
          id: `optimistic-${Date.now()}`,
          content: input.content,
          pinned: input.pinned ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Lead>(leadKeys.detail(leadId), {
          ...previousDetail,
          notes: [optimisticNote, ...previousDetail.notes],
        });
      }
      return { previousDetail };
    },
    onError: (_err, { leadId }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(leadKeys.detail(leadId), context.previousDetail);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useAddActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: CreateLeadActivityInput }) =>
      getLeadRepository().createActivity(leadId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useRecordContactMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: RecordContactInput }) =>
      getLeadRepository().recordContact(leadId, input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useCompleteActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leadId,
      activityId,
      done,
    }: {
      leadId: string;
      activityId: string;
      done: boolean;
    }) => getLeadRepository().completeActivity(leadId, activityId, done),
    onMutate: async ({ leadId, activityId, done }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.detail(leadId) });
      const previousDetail = queryClient.getQueryData<Lead>(leadKeys.detail(leadId));
      if (previousDetail) {
        queryClient.setQueryData<Lead>(leadKeys.detail(leadId), {
          ...previousDetail,
          activities: previousDetail.activities.map((a) =>
            a.id === activityId
              ? { ...a, done, completedAt: done ? new Date().toISOString() : undefined }
              : a,
          ),
        });
      }
      return { previousDetail };
    },
    onError: (_err, { leadId }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(leadKeys.detail(leadId), context.previousDetail);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useUpdateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leadId,
      noteId,
      content,
    }: {
      leadId: string;
      noteId: string;
      content: string;
    }) => getLeadRepository().updateNote(leadId, noteId, content),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useRemoveNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, noteId }: { leadId: string; noteId: string }) =>
      getLeadRepository().removeNote(leadId, noteId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useToggleNotePinMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, noteId }: { leadId: string; noteId: string }) =>
      getLeadRepository().toggleNotePin(leadId, noteId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(vars.leadId) });
    },
  });
}

export function useRemoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getLeadRepository().removeLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
    },
  });
}

/**
 * Supabase Realtime subscription to keep leads in sync across tabs/devices.
 * Subscribes to INSERT/UPDATE/DELETE on the `leads` table and invalidates the
 * list cache on any change — no polling needed.
 *
 * Only activates in real mode (demo mode uses local state).
 */
export function useLeadsRealtimeSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isRealMode) return;
    const supabase = getSupabase();

    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        // Invalidate list queries so they refetch fresh data.
        // Using a debounce-like approach: batch rapid changes into one invalidation.
        queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
