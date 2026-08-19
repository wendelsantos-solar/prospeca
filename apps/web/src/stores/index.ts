import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Lead,
  LeadStage,
  LeadFilters,
  Search,
  PresenceFilter,
  LeadNote,
  LeadActivity,
  SavedFilter,
  DashboardPeriod,
} from "@/types";
import type { DiscoveryResult } from "@/repositories/types";
import type { AdvancedDiscoveryFilters } from "@/lib/filters";
import {
  DEFAULT_MESSAGE_TEMPLATE,
  STORAGE_KEY,
  BULK_SELECTION_LIMIT,
  type SortValue,
} from "@/lib/constants";
import { isDemoMode } from "@/lib/env";
import { MAX_RADIUS_KM } from "@/lib/nearest-outside";
import { track } from "@/lib/analytics";
import { seedDemoLeads } from "@/repositories";
import { useActivationStore } from "@/stores/activation";

function seedRepo(leads: Lead[]) {
  if (!isDemoMode) return;
  try {
    seedDemoLeads(leads);
  } catch {
    // best-effort sync
  }
}

// SSR-safe storage: returns a no-op storage when window/localStorage is unavailable
function safeStorage() {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    return localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

// ---- Theme & UI ----
interface UIState {
  theme: "light" | "dark";
  density: "compact" | "comfortable";
  sidebarCollapsed: boolean;
  collapsedColumns: LeadStage[];
  mapShowCircle: boolean;
  mapDark: boolean;
  mapLegendCollapsed: boolean;
  /** Discovery workspace view: the map, a full-width results list, or the
   * opportunity heatmap. ("territories" removido no LOTE 2, Tarefa 4 — a
   * view/tab saiu da UI na Fase remoção; TerritoriesView.tsx era órfão desde
   * então. O domínio/backend de territórios continuam intocados, só
   * desacoplados desta store.) */
  discoveryView: "map" | "list" | "heatmap";
  /** Heatmap metric (spec #38). */
  heatMetric: "opportunity" | "density" | "weak_digital" | "segment_concentration";
  /** Advanced discovery filters (V3-A progressive disclosure). */
  advancedFilters: AdvancedDiscoveryFilters;
  /** NavRail: 'auto' = default responsivo (>=1536 expandida, <1536 colapsada).
   * DECISÃO (P3-4 do gate): o default responsivo vale enquanto o usuário NUNCA
   * tocou no toggle — 'auto' persiste como 'auto' (sem preferência). O
   * PRIMEIRO clique no toggle grava 'expanded'/'collapsed' EXPLÍCITO, e a
   * partir daí a escolha do usuário MANDA em qualquer viewport. */
  navMode: "auto" | "expanded" | "collapsed";
  /** Centro atual do viewport do mapa — alimenta o 'Buscar nesta área' da
   * barra (Fase final). TRANSITÓRIO: nunca persistido. */
  mapViewport: { lat: number; lng: number } | null;
  setMapViewport: (v: { lat: number; lng: number } | null) => void;
  setNavMode: (v: "auto" | "expanded" | "collapsed") => void;
  toggleTheme: () => void;
  setDensity: (d: "compact" | "comfortable") => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleColumnCollapsed: (stage: LeadStage) => void;
  setMapShowCircle: (v: boolean) => void;
  setMapDark: (v: boolean) => void;
  setMapLegendCollapsed: (v: boolean) => void;
  setDiscoveryView: (v: "map" | "list" | "heatmap") => void;
  setHeatMetric: (v: "opportunity" | "density" | "weak_digital" | "segment_concentration") => void;
  setAdvancedFilters: (patch: Partial<AdvancedDiscoveryFilters>) => void;
  /** Limpa TODOS os filtros avançados/locais (merge com {} não limpa nada). */
  resetAdvancedFilters: () => void;
}
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      density: "comfortable",
      sidebarCollapsed: false,
      collapsedColumns: [],
      mapShowCircle: true,
      mapDark: false,
      mapLegendCollapsed: false,
      // FASE C: default para quem NUNCA usou o produto (storage limpo) — a
      // promessa da landing é "quem abordar primeiro e por quê" (priorização
      // + explicação), que a LISTA responde e o mapa não (score em anel,
      // badge de decisor, confiança e status de enriquecimento não cabem num
      // pino). Só afeta hidratação sem blob persistido: quem já tem
      // discoveryView salvo (qualquer versão ≤3) carrega o PRÓPRIO valor via
      // migrate() abaixo, nunca este literal — ver nota em migrate.
      discoveryView: "list",
      heatMetric: "opportunity",
      advancedFilters: {},
      navMode: "auto",
      mapViewport: null,
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setDensity: (density) => set({ density }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleColumnCollapsed: (stage) =>
        set((s) => ({
          collapsedColumns: s.collapsedColumns.includes(stage)
            ? s.collapsedColumns.filter((c) => c !== stage)
            : [...s.collapsedColumns, stage],
        })),
      setMapShowCircle: (mapShowCircle) => set({ mapShowCircle }),
      setMapDark: (mapDark) => set({ mapDark }),
      setMapLegendCollapsed: (mapLegendCollapsed) => set({ mapLegendCollapsed }),
      setDiscoveryView: (discoveryView) => set({ discoveryView }),
      setNavMode: (navMode) => set({ navMode }),
      setMapViewport: (mapViewport) => set({ mapViewport }),
      setHeatMetric: (heatMetric) => set({ heatMetric }),
      setAdvancedFilters: (patch) =>
        set((s) => ({ advancedFilters: { ...s.advancedFilters, ...patch } })),
      resetAdvancedFilters: () => set({ advancedFilters: {} }),
    }),
    {
      name: `${STORAGE_KEY}:ui`,
      version: 3,
      storage: createJSONStorage(() => safeStorage()),
      // Persiste SÓ o que faz sentido entre sessões (Fase 6b): estado de
      // apresentação e preferências explícitas. advancedFilters fica de fora —
      // filtros velhos de uma sessão antiga filtram silenciosamente uma busca
      // nova (mesma classe de bug de estado preso do navMode).
      partialize: (s) => ({
        theme: s.theme,
        density: s.density,
        sidebarCollapsed: s.sidebarCollapsed,
        mapShowCircle: s.mapShowCircle,
        mapDark: s.mapDark,
        mapLegendCollapsed: s.mapLegendCollapsed,
        discoveryView: s.discoveryView,
        heatMetric: s.heatMetric,
        navMode: s.navMode,
      }),
      // Hidratação de blob antigo/corrompido NUNCA pode travar a UI: qualquer
      // navMode ausente ou fora do contrato cai em 'auto' (default seguro).
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (p.navMode !== "expanded" && p.navMode !== "collapsed" && p.navMode !== "auto") {
          p.navMode = "auto";
        }
        // v2→v3 (LOTE 2, Tarefa 4): "territories" saiu do tipo — quem tinha
        // essa view persistida (ou qualquer valor fora do contrato atual)
        // cai em "map", não numa tela em branco.
        if (
          p.discoveryView !== "map" &&
          p.discoveryView !== "list" &&
          p.discoveryView !== "heatmap"
        ) {
          p.discoveryView = "map";
        }
        return p as never;
      },
    },
  ),
);

// ---- Settings ----
interface SettingsState {
  userName: string;
  companyName: string;
  bulkLimit: number;
  defaultPresence: PresenceFilter;
  defaultRadius: number;
  defaultSort: SortValue;
  signature: string;
  senderName: string;
  set: (patch: Partial<Omit<SettingsState, "set">>) => void;
}
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      userName: "",
      companyName: "",
      bulkLimit: BULK_SELECTION_LIMIT,
      defaultPresence: "all",
      defaultRadius: 10,
      defaultSort: "relevance",
      signature: "",
      senderName: "",
      // Clamp aqui, não só na migração: é o único setter (MotorSettings), mas
      // defensivo é mais barato que outro F3 (estado salvo virando estado
      // inválido silencioso).
      set: (patch) =>
        set(
          patch.defaultRadius != null
            ? { ...patch, defaultRadius: Math.min(patch.defaultRadius, MAX_RADIUS_KM) }
            : patch,
        ),
    }),
    {
      name: `${STORAGE_KEY}:settings`,
      storage: createJSONStorage(() => safeStorage()),
      version: 1,
      // v0 (pré-LOTE 2) podia ter defaultRadius até 100 — o slider hoje vai
      // só até MAX_RADIUS_KM (50, teto real do provider). Sem isto, blob
      // antigo hidrata um raio que nenhum controle da UI consegue exibir.
      migrate: (persisted) => {
        const state = persisted as Partial<SettingsState>;
        if (state && typeof state.defaultRadius === "number") {
          state.defaultRadius = Math.min(state.defaultRadius, MAX_RADIUS_KM);
        }
        return state as SettingsState;
      },
    },
  ),
);

// ---- Leads store ----
export type ToggleSelectResult = "added" | "removed" | "limit";

interface LeadsState {
  leads: Lead[];
  loaded: boolean;
  searching: boolean;
  searchError: string | null;
  currentSearch: Search | null;
  previewLocation: { lat: number; lng: number; radiusKm: number; label: string } | null;
  history: Search[];
  filters: LeadFilters;
  savedFilters: SavedFilter[];
  sort: SortValue;
  selectedIds: string[];
  bulkMode: boolean;
  focusedId: string | null;
  detailsId: string | null;
  /** A discovered business being previewed read-only (not yet a lead). Mutually
   * exclusive with detailsId at the UI level. */
  preview: DiscoveryResult | null;
  pendingWinId: string | null;
  pendingDiscardId: string | null;
  kanbanOrder: Record<string, number>;
  setSearching: (v: boolean) => void;
  setSearchError: (msg: string | null) => void;
  setLeads: (leads: Lead[], search: Search) => void;
  /** Open a previously-run (or saved) search's results WITHOUT re-running it —
   * sets the search context so `useDiscoveryResults` reads its persisted rows. */
  openSearch: (search: Search) => void;
  setPreviewLocation: (p: LeadsState["previewLocation"]) => void;
  reset: () => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  removeLead: (id: string) => void;
  setStage: (id: string, stage: LeadStage, extra?: Partial<Lead>) => void;
  addNote: (id: string, note: Omit<LeadNote, "id" | "createdAt">) => void;
  updateNote: (id: string, noteId: string, content: string) => void;
  toggleNotePin: (id: string, noteId: string) => void;
  removeNote: (id: string, noteId: string) => void;
  addActivity: (id: string, act: Omit<LeadActivity, "id">) => void;
  setFilters: (patch: Partial<LeadFilters>) => void;
  replaceFilters: (filters: LeadFilters) => void;
  toggleQuickFilter: (chip: string) => void;
  clearFilters: () => void;
  saveFilterSet: (name: string) => void;
  deleteFilterSet: (id: string) => void;
  setSort: (s: SortValue) => void;
  toggleSelect: (id: string, limit?: number) => ToggleSelectResult;
  clearSelection: () => void;
  setBulkMode: (v: boolean) => void;
  selectVisible: (ids: string[], limit?: number) => void;
  setFocused: (id: string | null) => void;
  setDetails: (id: string | null) => void;
  setPreview: (r: DiscoveryResult | null) => void;
  setPendingWin: (id: string | null) => void;
  setPendingDiscard: (id: string | null) => void;
  reorderInColumn: (stage: LeadStage, orderedIds: string[]) => void;
  removeSearch: (id: string) => void;
}

const defaultFilters: LeadFilters = { quick: [] };

const now = () => new Date().toISOString();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function recordLeadViewed(surface: "discovery" | "pipeline", score?: number) {
  const metadata = { surface, ...(score == null ? {} : { score }) };
  track("lead_viewed", metadata);
  useActivationStore.getState().mark("firstLeadViewed", metadata);
}

export const useLeadsStore = create<LeadsState>()(
  persist(
    (set, get) => ({
      leads: [],
      loaded: false,
      searching: false,
      searchError: null,
      currentSearch: null,
      previewLocation: null,
      history: [],
      filters: defaultFilters,
      savedFilters: [],
      sort: "relevance",
      selectedIds: [],
      bulkMode: false,
      focusedId: null,
      detailsId: null,
      preview: null,
      pendingWinId: null,
      pendingDiscardId: null,
      kanbanOrder: {},
      setSearching: (searching) => set({ searching }),
      setSearchError: (searchError) => set({ searchError }),
      setLeads: (leads, search) => {
        // Sync with demo repository so TanStack Query hooks see the same data
        seedRepo(leads);
        set((s) => ({
          leads,
          loaded: true,
          searching: false,
          searchError: null,
          currentSearch: search,
          previewLocation: null,
          history: [{ ...search }, ...s.history].slice(0, 20),
          selectedIds: [],
          focusedId: null,
          kanbanOrder: {},
        }));
        useSearchDraftStore.getState().resetDraftTo(search);
      },
      openSearch: (search) => {
        set({
          currentSearch: search,
          loaded: true,
          searching: false,
          searchError: null,
          previewLocation: null,
          selectedIds: [],
          focusedId: null,
          kanbanOrder: {},
        });
        useSearchDraftStore.getState().resetDraftTo(search);
      },
      setPreviewLocation: (previewLocation) => set({ previewLocation }),
      reset: () =>
        set({
          leads: [],
          loaded: false,
          currentSearch: null,
          selectedIds: [],
          focusedId: null,
          detailsId: null,
          kanbanOrder: {},
        }),
      updateLead: (id, patch) =>
        set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeLead: (id) =>
        set((s) => ({
          leads: s.leads.filter((l) => l.id !== id),
          selectedIds: s.selectedIds.filter((x) => x !== id),
          focusedId: s.focusedId === id ? null : s.focusedId,
          detailsId: s.detailsId === id ? null : s.detailsId,
        })),
      setStage: (id, stage, extra) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  ...extra,
                  stage,
                  lastInteractionAt: now(),
                  timeline: [
                    ...l.timeline,
                    { id: uid("t"), kind: "stage", label: `Movido para ${stage}`, at: now() },
                  ],
                }
              : l,
          ),
        })),
      addNote: (id, note) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  notes: [{ id: uid("n"), createdAt: now(), ...note }, ...l.notes],
                  timeline: [
                    ...l.timeline,
                    { id: uid("t"), kind: "note", label: "Nota criada", at: now() },
                  ],
                }
              : l,
          ),
        })),
      updateNote: (id, noteId, content) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  notes: l.notes.map((n) =>
                    n.id === noteId ? { ...n, content, updatedAt: now() } : n,
                  ),
                }
              : l,
          ),
        })),
      toggleNotePin: (id, noteId) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? {
                  ...l,
                  notes: l.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)),
                }
              : l,
          ),
        })),
      removeNote: (id, noteId) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id ? { ...l, notes: l.notes.filter((n) => n.id !== noteId) } : l,
          ),
        })),
      addActivity: (id, act) =>
        set((s) => {
          const activity = { id: uid("a"), ...act };
          return {
            leads: s.leads.map((l) =>
              l.id === id
                ? {
                    ...l,
                    activities: [activity, ...l.activities],
                    nextActivity: activity,
                    timeline: [
                      ...l.timeline,
                      {
                        id: uid("t"),
                        kind: "activity",
                        label: `Atividade: ${act.title}`,
                        at: now(),
                      },
                    ],
                  }
                : l,
            ),
          };
        }),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      replaceFilters: (filters) => set({ filters }),
      toggleQuickFilter: (chip) =>
        set((s) => {
          const has = s.filters.quick.includes(chip);
          return {
            filters: {
              ...s.filters,
              quick: has ? s.filters.quick.filter((c) => c !== chip) : [...s.filters.quick, chip],
            },
          };
        }),
      clearFilters: () => set({ filters: defaultFilters }),
      saveFilterSet: (name) =>
        set((s) => ({
          savedFilters: [...s.savedFilters, { id: uid("sf"), name, filters: s.filters }],
        })),
      deleteFilterSet: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      setSort: (sort) => set({ sort }),
      toggleSelect: (id, limit = BULK_SELECTION_LIMIT) => {
        const s = get();
        if (s.selectedIds.includes(id)) {
          set({ selectedIds: s.selectedIds.filter((x) => x !== id) });
          return "removed";
        }
        if (s.selectedIds.length >= limit) return "limit";
        set({ selectedIds: [...s.selectedIds, id] });
        return "added";
      },
      clearSelection: () => set({ selectedIds: [] }),
      setBulkMode: (v) => set({ bulkMode: v, selectedIds: v ? get().selectedIds : [] }),
      selectVisible: (ids, limit = BULK_SELECTION_LIMIT) =>
        set({ selectedIds: ids.slice(0, limit) }),
      setFocused: (focusedId) => set({ focusedId }),
      setDetails: (detailsId) => {
        if (detailsId) recordLeadViewed("pipeline");
        set({ detailsId, ...(detailsId ? { preview: null } : {}) });
      },
      setPreview: (preview) => {
        if (preview) recordLeadViewed("discovery", preview.score);
        set({ preview, ...(preview ? { detailsId: null } : {}) });
      },
      setPendingWin: (pendingWinId) => set({ pendingWinId }),
      setPendingDiscard: (pendingDiscardId) => set({ pendingDiscardId }),
      reorderInColumn: (_stage, orderedIds) =>
        set((s) => {
          const next = { ...s.kanbanOrder };
          orderedIds.forEach((id, i) => {
            next[id] = i;
          });
          return { kanbanOrder: next };
        }),
      removeSearch: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
    }),
    {
      name: `${STORAGE_KEY}:leads`,
      storage: createJSONStorage(() => safeStorage()),
      partialize: (s) => ({
        // leads removed from persist — the full array (notes, activities,
        // timeline) can reach 200KB+ and serializing on every keystroke-level
        // state change blocks the main thread. The CRM list is now served by
        // TanStack Query (useLeadsList) which has its own cache layer.
        loaded: s.loaded,
        currentSearch: s.currentSearch,
        history: s.history,
        filters: s.filters,
        savedFilters: s.savedFilters,
        sort: s.sort,
        kanbanOrder: s.kanbanOrder,
      }),
    },
  ),
);

// ---- Message template ----
export type MessageTemplateType =
  | "first_contact"
  | "follow_up"
  | "return"
  | "reengagement"
  | "proposal"
  | "custom";

interface MessageState {
  templateName: string;
  template: string;
  templateType: MessageTemplateType;
  lastEditedAt: string | null;
  setTemplateName: (n: string) => void;
  setTemplate: (t: string) => void;
  setTemplateType: (t: MessageTemplateType) => void;
  reset: () => void;
}
export const useMessageStore = create<MessageState>()(
  persist(
    (set) => ({
      templateName: "Abordagem padrão",
      template: DEFAULT_MESSAGE_TEMPLATE,
      templateType: "first_contact",
      lastEditedAt: null,
      setTemplateName: (templateName) =>
        set({ templateName, lastEditedAt: new Date().toISOString() }),
      setTemplate: (template) => set({ template, lastEditedAt: new Date().toISOString() }),
      setTemplateType: (templateType) =>
        set({ templateType, lastEditedAt: new Date().toISOString() }),
      reset: () =>
        set({
          template: DEFAULT_MESSAGE_TEMPLATE,
          templateName: "Abordagem padrão",
          templateType: "first_contact",
          lastEditedAt: new Date().toISOString(),
        }),
    }),
    { name: `${STORAGE_KEY}:msg`, storage: createJSONStorage(() => safeStorage()) },
  ),
);

// ---- Dashboard period ----
interface PeriodState {
  period: DashboardPeriod;
  customFrom: string;
  customTo: string;
  setPeriod: (p: DashboardPeriod) => void;
  setCustomRange: (from: string, to: string) => void;
}
export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      period: "30d",
      customFrom: "",
      customTo: "",
      setPeriod: (period) => set({ period }),
      setCustomRange: (customFrom, customTo) => set({ customFrom, customTo }),
    }),
    { name: `${STORAGE_KEY}:period`, storage: createJSONStorage(() => safeStorage()) },
  ),
);

// ---- Última localização escolhida (memória de onboarding) ----
export interface SavedLocation {
  label: string;
  lat: number;
  lng: number;
}
interface LocationState {
  lastLocation: SavedLocation | null;
  setLastLocation: (l: SavedLocation) => void;
}
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      lastLocation: null,
      setLastLocation: (lastLocation) => set({ lastLocation }),
    }),
    { name: `${STORAGE_KEY}:location`, storage: createJSONStorage(() => safeStorage()) },
  ),
);

// ---- Search draft (rascunho da config do Radar; NÃO persistido) ----
export interface SearchDraft {
  niche: string;
  location: string;
  coords: { lat: number; lng: number };
  radiusKm: number;
  presence: PresenceFilter;
  /** Quantidade de empresas a encontrar (V3-A; 10/25/50/100). Default 25. */
  maxResults?: number;
}
interface SearchDraftState {
  draft: SearchDraft;
  setDraft: (patch: Partial<SearchDraft>) => void;
  resetDraftTo: (search: Search) => void;
  /** Zera o rascunho (chip de intenção "limpar") — volta aos defaults iniciais. */
  reset: () => void;
}
const initialDraft: SearchDraft = {
  niche: "",
  location: "",
  coords: { lat: 0, lng: 0 },
  radiusKm: 10,
  presence: "all",
  maxResults: 25,
};
export const useSearchDraftStore = create<SearchDraftState>()((set) => ({
  draft: initialDraft,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraftTo: (search) =>
    set({
      draft: {
        niche: search.niche,
        location: search.location,
        coords: { lat: search.latitude, lng: search.longitude },
        // Missão salva antes do LOTE 2 pode ter raio > MAX_RADIUS_KM (teto
        // era 100). Sem o clamp, o slider herdava um valor fora do seu
        // próprio range — mesma classe de estado inválido silencioso do F3.
        radiusKm: Math.min(search.radiusKm, MAX_RADIUS_KM),
        presence: search.presence,
      },
    }),
  reset: () => set({ draft: { ...initialDraft } }),
}));

export function applyPresenceFilter(presence: PresenceFilter, leads: Lead[]) {
  if (presence === "no-website") return leads.filter((l) => !l.hasWebsite);
  if (presence === "with-website") return leads.filter((l) => l.hasWebsite);
  return leads;
}
