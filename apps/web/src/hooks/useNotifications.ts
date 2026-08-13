import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isRealMode } from "@/lib/env";
import { invokeFunction } from "@/lib/supabase";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { generateNotifications, type AppNotification } from "@/lib/notifications";
import { useNotificationsStore } from "@/stores/notifications";

/**
 * Unified notifications source.
 *
 * Real mode: server-backed — `get-notifications` derives from the funnel using
 * the SAME domain rule and persists read/dismissed per user (multi-device).
 * Demo mode: client-side derivation + localStorage read state (no Supabase).
 *
 * Both modes return the same shape, so the UI doesn't care which path is live.
 */
export interface NotificationItem extends AppNotification {
  readAt?: string | null;
  dismissedAt?: string | null;
}

interface GetNotificationsResponse {
  items: NotificationItem[];
  unread: number;
}

export interface UseNotificationsResult {
  items: NotificationItem[];
  unread: number;
  isLoading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissAll: () => void;
}

export function useNotifications(): UseNotificationsResult {
  const queryClient = useQueryClient();

  // ── Real mode ───────────────────────────────────────────────────────────
  const real = useQuery<GetNotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () =>
      invokeFunction<GetNotificationsResponse>("get-notifications", { action: "list" }),
    enabled: isRealMode,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // ── Demo mode ───────────────────────────────────────────────────────────
  const { data } = useLeadsList({ quick: [] });
  const leads = useMemo(() => data?.items ?? [], [data]);
  const demoNotifications = useMemo(() => generateNotifications(leads), [leads]);
  const readIds = useNotificationsStore((s) => s.readIds);
  const dismissedIds = useNotificationsStore((s) => s.dismissedIds);
  const demoMarkRead = useNotificationsStore((s) => s.markRead);
  const demoMarkAllRead = useNotificationsStore((s) => s.markAllRead);
  const demoDismissAll = useNotificationsStore((s) => s.dismissAll);

  const demoItems: NotificationItem[] = useMemo(
    () =>
      demoNotifications
        .filter((n) => !dismissedIds.includes(n.id))
        .map((n) => ({
          ...n,
          readAt: readIds.includes(n.id) ? "read" : null,
          dismissedAt: dismissedIds.includes(n.id) ? "dismissed" : null,
        })),
    [demoNotifications, readIds, dismissedIds],
  );
  const demoUnread = demoItems.filter((i) => i.readAt == null).length;

  const call = (action: string, key?: string) =>
    invokeFunction("get-notifications", { action, ...(key ? { key } : {}) });

  function markRead(id: string) {
    if (!isRealMode) {
      demoMarkRead(id);
      return;
    }
    queryClient.setQueryData<GetNotificationsResponse>(["notifications"], (old) =>
      old
        ? {
            items: old.items.map((i) =>
              i.id === id && i.readAt == null ? { ...i, readAt: new Date().toISOString() } : i,
            ),
            unread: Math.max(0, old.unread - 1),
          }
        : old,
    );
    void call("mark_read", id).catch(() =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    );
  }

  function markAllRead() {
    if (!isRealMode) {
      demoMarkAllRead(demoItems.map((i) => i.id));
      return;
    }
    queryClient.setQueryData<GetNotificationsResponse>(["notifications"], (old) =>
      old
        ? {
            items: old.items.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })),
            unread: 0,
          }
        : old,
    );
    void call("mark_all_read").catch(() =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    );
  }

  function dismissAll() {
    if (!isRealMode) {
      demoDismissAll(demoItems.map((i) => i.id));
      return;
    }
    queryClient.setQueryData<GetNotificationsResponse>(["notifications"], (old) =>
      old ? { items: [], unread: 0 } : old,
    );
    void call("dismiss_all").catch(() =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    );
  }

  if (isRealMode) {
    const items = (real.data?.items ?? []).filter((i) => i.dismissedAt == null);
    const unread = items.filter((i) => i.readAt == null).length;
    return { items, unread, isLoading: real.isLoading, markRead, markAllRead, dismissAll };
  }

  return {
    items: demoItems,
    unread: demoUnread,
    isLoading: false,
    markRead,
    markAllRead,
    dismissAll,
  };
}
