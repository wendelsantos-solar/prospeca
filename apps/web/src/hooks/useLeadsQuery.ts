/**
 * TanStack Query hooks for Lead CRUD operations.
 * Replaces Zustand useLeadsStore data operations (not UI state).
 *
 * Phase 3 — CRM real: Kanban, list, notes, activities, details.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeadRepository, getSearchRepository } from "@/repositories";
import type { Lead, LeadFilters, CreateLeadNoteInput, CreateLeadActivityInput } from "@/types";
import type { MoveLeadInput, PaginatedResult, DiscoveryResult } from "@/repositories/types";

// ── Query keys ──────────────────────────────────────────────

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters: LeadFilters, sort?: string) => ["leads", "list", filters, sort] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
};

export const discoveryKeys = {
  bySearch: (searchId: string) => ["discovery", searchId] as const,
};

export const suppressionKeys = { all: ["suppression"] as const };

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
 * (map + sidebar) does NOT use this; it uses useDiscoveryResults. */
export function useLeadsList(filters: LeadFilters, sort?: string) {
  return useQuery<PaginatedResult<Lead>>({
    queryKey: leadKeys.list(filters, sort),
    queryFn: () => getLeadRepository().list({ filters, sort, pageSize: 500 }),
    staleTime: 60_000,
    structuralSharing: true,
  });
}

/** Discovery results for a search (map + sidebar list). Reads search_results ⋈
 * places via RPC; never creates leads. */
export function useDiscoveryResults(searchId?: string) {
  return useQuery<DiscoveryResult[]>({
    queryKey: searchId ? discoveryKeys.bySearch(searchId) : ["discovery", "none"],
    queryFn: () => (searchId ? getSearchRepository().getDiscovery(searchId) : Promise.resolve([])),
    enabled: !!searchId,
    staleTime: 60_000,
  });
}

/** Materialize a discovered business as a lead in the funnel. */
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
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
      queryClient.invalidateQueries({ queryKey: discoveryKeys.bySearch(vars.searchId) });
      // Enriquecimento pesado (scrape de site) sob demanda, só para os leads
      // recém-criados que têm site. Fire-and-forget; refresca ao terminar.
      const repo = getSearchRepository();
      Promise.allSettled(data.enrichableLeadIds.map((id) => repo.enrichLead(id))).then(() => {
        queryClient.invalidateQueries({ queryKey: leadKeys.all });
      });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useUpdateLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Lead> }) =>
      getLeadRepository().update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useAddNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: CreateLeadNoteInput }) =>
      getLeadRepository().createNote(leadId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useAddActivityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: CreateLeadActivityInput }) =>
      getLeadRepository().createActivity(leadId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useRemoveNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, noteId }: { leadId: string; noteId: string }) =>
      getLeadRepository().removeNote(leadId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useToggleNotePinMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, noteId }: { leadId: string; noteId: string }) =>
      getLeadRepository().toggleNotePin(leadId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

export function useRemoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getLeadRepository().removeLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}
