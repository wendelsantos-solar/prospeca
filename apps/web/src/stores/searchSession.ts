import { create } from "zustand";

/**
 * Search-session store — replaces the window event bus (C5).
 *
 * Before: 7 CustomEvent types, 12 dispatch sites, SearchForm as sole listener.
 * After: one store; components call actions directly; SearchForm subscribes.
 */

export interface SuggestSearchInput {
  niche: string;
  location: string;
  lat: number;
  lng: number;
  presence: string;
  radiusKm?: number;
}

interface SearchSessionState {
  /** SearchForm registers its runSearch callback here (stable ref). */
  _runSearch: ((input?: Record<string, unknown>) => void) | null;
  /** SearchForm registers its setDraft callback here (stable ref). */
  _setDraft: ((patch: Record<string, unknown>) => void) | null;
  /** Focus the niche input. */
  _focusNiche: (() => void) | null;

  /** Register callbacks from SearchForm. Called once on mount. */
  register: (handlers: {
    runSearch: (input?: Record<string, unknown>) => void;
    setDraft: (patch: Record<string, unknown>) => void;
    focusNiche: () => void;
  }) => void;

  // --- Public actions (called by any component) ---

  /** Focus the niche combobox. */
  focusNiche: () => void;
  /** Geolocation resolved — set draft location. */
  geoLocated: (label: string, lat: number, lng: number) => void;
  /** Full-blown search suggestion (from history, sidebar, etc.). */
  suggestSearch: (input: SuggestSearchInput) => void;
  /** Retry the current search as-is. */
  retrySearch: () => void;
  /** Run a radar-area search. */
  radarSearch: () => void;
  /** Re-run the current search bypassing cache. */
  refreshSearch: () => void;
}

export const useSearchSession = create<SearchSessionState>()((set, get) => ({
  _runSearch: null,
  _setDraft: null,
  _focusNiche: null,

  register: (handlers) =>
    set({
      _runSearch: handlers.runSearch,
      _setDraft: handlers.setDraft,
      _focusNiche: handlers.focusNiche,
    }),

  focusNiche: () => get()._focusNiche?.(),

  geoLocated: (label, lat, lng) => {
    get()._setDraft?.({ location: label, coords: { lat, lng } });
  },

  suggestSearch: (input) => {
    const { _setDraft, _runSearch } = get();
    _setDraft?.({
      niche: input.niche,
      location: input.location,
      coords: { lat: input.lat, lng: input.lng },
      presence: input.presence,
      radiusKm: input.radiusKm,
    });
    _runSearch?.({
      niche: input.niche,
      location: input.location,
      latitude: input.lat,
      longitude: input.lng,
      presence: input.presence,
      radiusKm: input.radiusKm,
    });
  },

  retrySearch: () => get()._runSearch?.(),

  radarSearch: () => get()._runSearch?.(),

  refreshSearch: () => get()._runSearch?.({ forceRefresh: true }),
}));
