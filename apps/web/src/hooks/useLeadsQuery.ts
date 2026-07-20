/**
 * TanStack Query hooks for Lead CRUD operations.
 * Replaces Zustand useLeadsStore data operations (not UI state).
 *
 * Phase 3 — CRM real: Kanban, list, notes, activities, details.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeadRepository } from "@/repositories";
import type { Lead, LeadFilters, CreateLeadNoteInput, CreateLeadActivityInput } from "@/types";
import type { MoveLeadInput, PaginatedResult } from "@/repositories/types";

// ── Query keys ──────────────────────────────────────────────

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters: LeadFilters, sort?: string) => ["leads", "list", filters, sort] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
};

// ── Queries ─────────────────────────────────────────────────

export function useLeadsList(filters: LeadFilters, sort?: string) {
  return useQuery<PaginatedResult<Lead>>({
    queryKey: leadKeys.list(filters, sort),
    queryFn: () => getLeadRepository().list({ filters, sort, pageSize: 200 }),
    staleTime: 60_000,
    structuralSharing: true,
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
