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
import {
  DEFAULT_MESSAGE_TEMPLATE,
  STORAGE_KEY,
  BULK_SELECTION_LIMIT,
  type SortValue,
} from "@/lib/constants";
import { isDemoMode } from "@/lib/env";
import { seedDemoLeads } from "@/repositories";

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
  /** Discovery workspace view: the map, or a full-width results list. */
  discoveryView: "map" | "list";
  toggleTheme: () => void;
  setDensity: (d: "compact" | "comfortable") => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleColumnCollapsed: (stage: LeadStage) => void;
  setMapShowCircle: (v: boolean) => void;
  setMapDark: (v: boolean) => void;
  setDiscoveryView: (v: "map" | "list") => void;
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
      discoveryView: "map",
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
      setDiscoveryView: (discoveryView) => set({ discoveryView }),
    }),
    { name: `${STORAGE_KEY}:ui`, storage: createJSONStorage(() => safeStorage()) },
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
      set: (patch) => set(patch),
    }),
    { name: `${STORAGE_KEY}:settings`, storage: createJSONStorage(() => safeStorage()) },
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
      setDetails: (detailsId) => set({ detailsId }),
      setPreview: (preview) => set({ preview }),
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
        leads: s.leads,
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
}
interface SearchDraftState {
  draft: SearchDraft;
  setDraft: (patch: Partial<SearchDraft>) => void;
  resetDraftTo: (search: Search) => void;
}
const initialDraft: SearchDraft = {
  niche: "",
  location: "",
  coords: { lat: 0, lng: 0 },
  radiusKm: 10,
  presence: "all",
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
        radiusKm: search.radiusKm,
        presence: search.presence,
      },
    }),
}));

export function applyPresenceFilter(presence: PresenceFilter, leads: Lead[]) {
  if (presence === "no-website") return leads.filter((l) => !l.hasWebsite);
  if (presence === "with-website") return leads.filter((l) => l.hasWebsite);
  return leads;
}
