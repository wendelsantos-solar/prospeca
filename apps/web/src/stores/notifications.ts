import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEY } from "@/lib/constants";

/**
 * Persisted read/dismissed state for the notification bell.
 *
 * Notifications themselves are *generated* on every render from the current
 * funnel (`generateNotifications`) — there is no notifications table. Their
 * IDs are deterministic per lead/activity, so persisting the read/dismissed
 * IDs here is what makes "mark as read" survive a refresh. Before this store
 * existed the state lived in component `useState` and reset on every reload,
 * which is exactly the reported bug ("marco como lido, recarrego e volta").
 */

const MAX_TRACKED = 1000; // hard cap so localStorage can't grow unbounded

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

function pushUnique(current: string[], ids: string[]): string[] {
  const set = new Set(current);
  for (const id of ids) set.add(id);
  return Array.from(set).slice(-MAX_TRACKED);
}

interface NotificationsState {
  readIds: string[];
  dismissedIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  dismiss: (id: string) => void;
  dismissAll: (ids: string[]) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      readIds: [],
      dismissedIds: [],
      markRead: (id) =>
        set((s) => (s.readIds.includes(id) ? s : { readIds: pushUnique(s.readIds, [id]) })),
      markAllRead: (ids) => set((s) => ({ readIds: pushUnique(s.readIds, ids) })),
      dismiss: (id) =>
        set((s) =>
          s.dismissedIds.includes(id) ? s : { dismissedIds: pushUnique(s.dismissedIds, [id]) },
        ),
      dismissAll: (ids) => set((s) => ({ dismissedIds: pushUnique(s.dismissedIds, ids) })),
    }),
    {
      name: `${STORAGE_KEY}:notifications`,
      storage: createJSONStorage(() => safeStorage()),
    },
  ),
);
