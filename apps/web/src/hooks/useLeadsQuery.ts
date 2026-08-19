/**
 * TanStack Query hooks for Lead CRUD operations.
 * Replaces Zustand useLeadsStore data operations (not UI state).
 *
 * Phase 3 — CRM real: Kanban, list, notes, activities, details.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { getLeadRepository, getSearchRepository, getDashboardRepository } from "@/repositories";
import type { ExportPipelineFilters } from "@/repositories/types";
import type { PeriodWindow } from "@/lib/period";
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
import { buildCompanyTimeline, type CompanyTimelineEvent } from "@leads/domain";
import type { SortValue } from "@/lib/constants";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { isRealMode } from "@/lib/env";

// ── Query keys ──────────────────────────────────────────────

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters: LeadFilters, sort?: SortValue) => ["leads", "list", filters, sort] as const,
  // CHAVE SEPARADA da useQuery: colisão de cache entre useQuery e
  // useInfiniteQuery no MESMO key (["leads","list",...]) fazia o TanStack
  // tratar os dois como uma entrada só (shape paginado vs. shape de páginas).
  // P1-a do gate: corrigido na CAUSA, não no sintoma.
  infiniteList: (filters: LeadFilters, sort?: SortValue) =>
    ["leads", "list-infinite", filters, sort] as const,
  stageCounts: ["leads", "stage-counts"] as const,
  todayCounts: ["leads", "today-counts"] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
};

/**
 * Aplica uma mutação otimista em TODOS os shapes de cache de leads:
 * o paginado (useLeadsList — { items }) e o infinite (useLeadsListInfinite —
 * { pages[].items }). Toda invalidação usa leadKeys.all (raiz que cobre ambos),
 * então update otimista e invalidação nunca mais ficam desalinhados.
 */
export function mutateLeadCaches(
  queryClient: QueryClient,
  mutateItems: (items: Lead[] | undefined) => Lead[] | undefined,
) {
  queryClient.setQueriesData({ queryKey: leadKeys.all }, (old: unknown) => {
    if (!old || typeof old !== "object") return old;
    const paginated = old as { items?: Lead[] };
    if (paginated.items) {
      return { ...paginated, items: mutateItems(paginated.items) };
    }
    const infinite = old as { pages?: Array<{ items?: Lead[] }> };
    if (infinite.pages) {
      return {
        ...infinite,
        pages: infinite.pages.map((page) => ({ ...page, items: mutateItems(page.items) })),
      };
    }
    return old;
  });
}

export const discoveryKeys = {
  bySearch: (searchId: string) => ["discovery", searchId] as const,
};

export const suppressionKeys = { all: ["suppression"] as const };

// ── Business registry (CNPJ) — Fase 5 ────────────────────────────────

export const businessRegistrationKeys = {
  byPlace: (placeId: string) => ["business-registration", placeId] as const,
};

export const companyPeopleKeys = {
  byPlace: (placeId: string) => ["company-people", placeId] as const,
};

export const cnpjOriginKeys = {
  byPlace: (placeId: string) => ["cnpj-origin", placeId] as const,
};

/** Registration fields persisted on the place by lookup-cnpj (RLS read). */
export interface BusinessRegistrationRow {
  tax_id: string | null;
  legal_name: string | null;
  primary_cnae: string | null;
  cnae_description: string | null;
  secondary_cnaes?: string[] | null;
  registration_status: string | null;
  registration_status_description: string | null;
  registration_fetched_at: string | null;
  enrichment_sources: unknown;
  company_size?: string | null;
  legal_nature?: string | null;
  capital_social?: number | null;
  simples_nacional?: boolean | null;
  simples_opted_at?: string | null;
  is_mei?: boolean | null;
  founded_at?: string | null;
  registry_city?: string | null;
  /**
   * QSA — snapshot BRUTO da fonte. A visão de produto (pessoas + decisores)
   * vem de `useCompanyPeople`; isto aqui é a evidência de origem.
   */
  qsa?: Array<{ name: string; qualification: string | null }> | null;
  registry_state?: string | null;
  registry_postal_code?: string | null;
  registry_email?: string | null;
  registry_phone?: string | null;
  registry_street_address?: string | null;
  registry_district?: string | null;
  establishment_type?: string | null;
}

export function useBusinessRegistration(placeId?: string | null) {
  return useQuery<BusinessRegistrationRow | null>({
    queryKey: businessRegistrationKeys.byPlace(placeId ?? "none"),
    queryFn: async () => {
      if (!placeId) return null;
      const { data, error } = await getSupabase()
        .from("places")
        .select(
          "tax_id, legal_name, primary_cnae, cnae_description, secondary_cnaes, registration_status, registration_status_description, registration_fetched_at, enrichment_sources, company_size, legal_nature, capital_social, simples_nacional, simples_opted_at, is_mei, founded_at, registry_city, registry_state, registry_postal_code, registry_email, registry_phone, registry_street_address, registry_district, establishment_type, qsa",
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

/**
 * Pessoas ligadas à empresa, já classificadas como decisores (Fases 4–5).
 *
 * Leitura DIRETA sob RLS, mesma convenção de `useBusinessRegistration`: as
 * policies de `company_people`/`people` só liberam linhas da organização do
 * usuário, então não há endpoint novo a criar nem provider a expor.
 */
export interface CompanyPersonRow {
  id: string;
  role: string | null;
  role_band: "high" | "medium" | "low" | "unknown" | null;
  decision_score: number | null;
  decision_reasons: {
    version?: string;
    reasons?: string[];
    dataConfidence?: number;
  } | null;
  member_type: "company" | "person" | "foreign" | "unknown";
  source: string;
  source_provider: string;
  confidence: number;
  started_at: string | null;
  is_current: boolean;
  legal_representative_name: string | null;
  legal_representative_role: string | null;
  fetched_at: string;
  people: { full_name: string; identity_confidence: number } | null;
}

export function useCompanyPeople(placeId?: string | null) {
  return useQuery<CompanyPersonRow[]>({
    queryKey: companyPeopleKeys.byPlace(placeId ?? "none"),
    queryFn: async () => {
      if (!placeId) return [];
      const { data, error } = await getSupabase()
        .from("company_people")
        .select(
          "id, role, role_band, decision_score, decision_reasons, member_type, source, source_provider, confidence, started_at, is_current, legal_representative_name, legal_representative_role, fetched_at, people(full_name, identity_confidence)",
        )
        .eq("place_id", placeId)
        .order("decision_score", { ascending: false, nullsFirst: false });
      if (error) throw new Error(error.message);
      return (data as unknown as CompanyPersonRow[]) ?? [];
    },
    enabled: !!placeId,
    staleTime: 5 * 60_000,
  });
}

/**
 * Origem do CNPJ quando ele foi DESCOBERTO no site da empresa em vez de
 * digitado. Um CNPJ auto-descoberto pode ser o da agência que fez o site, e
 * exibi-lo sem essa ressalva o faria passar por dado oficial.
 */
export interface CnpjOriginRow {
  provider_external_id: string | null;
  confidence: number;
  fetched_at: string;
  metadata: { candidates?: string[]; ambiguous?: boolean; sourceUrl?: string } | null;
}

export function useCnpjOrigin(placeId?: string | null) {
  return useQuery<CnpjOriginRow | null>({
    queryKey: cnpjOriginKeys.byPlace(placeId ?? "none"),
    queryFn: async () => {
      if (!placeId) return null;
      const { data, error } = await getSupabase()
        .from("company_sources")
        .select("provider_external_id, confidence, fetched_at, metadata")
        .eq("place_id", placeId)
        .eq("provider", "website_cnpj")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as CnpjOriginRow | null) ?? null;
    },
    enabled: !!placeId,
    staleTime: 5 * 60_000,
  });
}

export function useCnpjLookupMutation(placeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cnpj: string) =>
      invokeFunction<{ found: boolean; reason?: string; peopleResolved?: number }>("lookup-cnpj", {
        placeId,
        cnpj,
      }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: businessRegistrationKeys.byPlace(placeId) });
      // A consulta reescreve pessoas e decisores — invalidar só o cadastro
      // deixaria a lista de decisores exibindo o resultado anterior.
      queryClient.invalidateQueries({ queryKey: companyPeopleKeys.byPlace(placeId) });
      queryClient.invalidateQueries({ queryKey: cnpjOriginKeys.byPlace(placeId) });
    },
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

/**
 * Paginação REAL (Fase 4.1): infinite query com fetch incremental. Substitui o
 * teto invisível de 50 leads — o total vem do servidor (count exact) e a UI
 * exibe "mostrando X de Y" com um botão explícito de carregar mais. Escolha:
 * useInfiniteQuery em vez de virtualização porque o Kanban precisa de dnd entre
 * colunas e um conjunto plano acumulado é mais simples e consistente que listas
 * virtualizadas por coluna; o fetch é incremental (50 por página) então nunca
 * carrega milhares de leads de uma vez.
 */
export function useLeadsListInfinite(filters: LeadFilters, sort?: SortValue) {
  return useInfiniteQuery<PaginatedResult<Lead>>({
    queryKey: leadKeys.infiniteList(filters, sort),
    queryFn: ({ pageParam }) =>
      getLeadRepository().list({ filters, sort, page: pageParam as number, pageSize: 50 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 60_000,
    structuralSharing: true,
  });
}

/** Totais por estágio vindos do SERVIDOR (COUNT) — nunca do array carregado. */
export function useLeadStageCounts(enabled = true) {
  return useQuery({
    queryKey: leadKeys.stageCounts,
    queryFn: () => getLeadRepository().stageCounts(),
    staleTime: 60_000,
    enabled,
  });
}

/** Contagens de hoje/atrasadas vindas do SERVIDOR (badge da navegação). */
export function useTodayCounts(enabled = true) {
  return useQuery({
    queryKey: leadKeys.todayCounts,
    queryFn: () => getLeadRepository().todayCounts(),
    staleTime: 60_000,
    enabled,
  });
}

/** Membros da organização ativa (para atribuição de responsável). */
export function useOrganizationMembers() {
  return useQuery({
    queryKey: ["organization", "members"],
    queryFn: () => getLeadRepository().members(),
    staleTime: 5 * 60_000,
  });
}

/**
 * Resolve IDs de leads no SERVIDOR — a seleção em lote não pode depender só
 * das páginas carregadas do infinite (se o cache resetar, IDs de páginas
 * descarregadas somiriam da ação sem aviso — P2 da 4d).
 */
export function useResolveLeadsBatch(ids: string[]) {
  const key = [...ids].sort();
  return useQuery({
    queryKey: ["leads", "resolve-batch", key],
    queryFn: () => getLeadRepository().getLeadsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

export function useAssignLeadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { leadId: string; userId: string | null }) =>
      getLeadRepository().assignLead(input.leadId, input.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
    },
  });
}

/** Export do pipeline via repositório (P1-b): erro já chega traduzido. */
export function useExportPipelineMutation() {
  return useMutation({
    mutationFn: (input: { format: "csv" | "xlsx"; filters: ExportPipelineFilters }) =>
      getLeadRepository().exportPipeline(input.format, input.filters),
  });
}

/**
 * Painel sobre a carteira INTEIRA: get_dashboard_overview (agregação
 * server-side com membership check) para a janela atual e a anterior — as
 * métricas nunca mais derivam do array truncado de 50 leads.
 */
export function useDashboardOverview(win: PeriodWindow, prevWin: PeriodWindow) {
  const current = useQuery({
    queryKey: ["dashboard", "overview", win.from.toISOString(), win.to.toISOString()],
    queryFn: () => getDashboardRepository().overview("custom", win.from, win.to),
    staleTime: 60_000,
  });
  const previous = useQuery({
    queryKey: ["dashboard", "overview", prevWin.from.toISOString(), prevWin.to.toISOString()],
    queryFn: () => getDashboardRepository().overview("custom", prevWin.from, prevWin.to),
    staleTime: 60_000,
  });
  return { current, previous };
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

/** Unified company timeline (V3-E) — system + commercial events merged by
 * the pure domain rule, read under RLS. */
export function useCompanyTimeline(placeId?: string | null) {
  return useQuery<CompanyTimelineEvent[]>({
    queryKey: ["company-timeline", placeId ?? "none"],
    queryFn: async () => {
      if (!placeId) return [];
      const data = await getSearchRepository().getCompanyTimeline(placeId);
      return buildCompanyTimeline(data);
    },
    enabled: !!placeId,
    staleTime: 60_000,
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
      await queryClient.cancelQueries({ queryKey: leadKeys.all });

      // Snapshot previous state for rollback.
      const previousDiscovery = queryClient.getQueryData<DiscoveryResult[]>(
        discoveryKeys.bySearch(searchId),
      );
      const previousLists = queryClient.getQueriesData({ queryKey: leadKeys.all });

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
      // Optimistic: anexa um card provisório em TODOS os shapes (lista e
      // infinite) — o lead real substitui no refetch.
      mutateLeadCaches(queryClient, (items) =>
        items ? [optimisticLead as unknown as Lead, ...items] : items,
      );

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
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
      await queryClient.cancelQueries({ queryKey: leadKeys.all });
      // Snapshot previous list data for rollback (paginated + infinite shapes)
      const previousLists = queryClient.getQueriesData({ queryKey: leadKeys.all });
      // Optimistic: paginated shape (useLeadsList) E infinite shape
      // (useLeadsListInfinite — data.pages[].items). Sem isso o otimismo vira
      // no-op no Kanban (P2-d do gate).
      queryClient.setQueriesData({ queryKey: leadKeys.all }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const patchItems = (items: Array<{ id: string; stage: string }> | undefined) =>
          items?.map((item) => (item.id === id ? { ...item, stage: input.toStage } : item));
        const paginated = old as { items?: Array<{ id: string; stage: string }> };
        if (paginated.items) {
          return { ...paginated, items: patchItems(paginated.items) };
        }
        const infinite = old as { pages?: Array<{ items?: Array<{ id: string; stage: string }> }> };
        if (infinite.pages) {
          return {
            ...infinite,
            pages: infinite.pages.map((page) => ({ ...page, items: patchItems(page.items) })),
          };
        }
        return old;
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
      // P2-c: invalidar também as CONTAGENS do servidor — o arrastar entre
      // colunas muda os totais por estágio.
      queryClient.invalidateQueries({ queryKey: leadKeys.stageCounts });
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
      queryClient.invalidateQueries({ queryKey: leadKeys.all });
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
        queryClient.invalidateQueries({ queryKey: leadKeys.all });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
