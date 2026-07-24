import { useMemo, useState } from "react";
import { Bell, Check, Trash2, AlertCircle, Clock, Trophy } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { useLeadsStore } from "@/stores";
import {
  generateNotifications,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";

const ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  overdue_activity: AlertCircle,
  stalled_lead: Clock,
  unanswered_proposal: Clock,
  deal_won: Trophy,
  info: Bell,
};

export function NotificationsPopover() {
  const { data } = useLeadsList({ quick: [] });
  const items = useMemo(() => data?.items ?? [], [data]);
  const setDetails = useLeadsStore((s) => s.setDetails);

  const notifications = useMemo(() => generateNotifications(items), [items]);

  // Read/dismissed state is session-local — there is no persisted notifications
  // store in this repo (unlike the prototype's zustand actions); notifications
  // are regenerated from the funnel on every render.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => notifications.filter((n) => !dismissedIds.has(n.id)),
    [notifications, dismissedIds],
  );
  const unread = useMemo(
    () => visible.filter((n) => !readIds.has(n.id)).length,
    [visible, readIds],
  );

  function handleSelect(n: AppNotification) {
    setReadIds((prev) => new Set(prev).add(n.id));
    if (n.leadId) setDetails(n.leadId);
  }

  function markAllRead() {
    setReadIds(new Set(visible.map((n) => n.id)));
  }

  function clearAll() {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      for (const n of visible) next.add(n.id);
      return next;
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              aria-live="polite"
              className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9.5px] font-bold text-primary-foreground"
            >
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div>
            <div className="text-[13px] font-semibold">Notificações</div>
            <div className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} não lidas` : "Tudo em dia"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Check className="h-3 w-3" /> Marcar todas
            </button>
            <button
              onClick={clearAll}
              aria-label="Limpar notificações"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
              Nenhuma notificação por aqui.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                const isRead = readIds.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleSelect(n)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60"
                    >
                      <div
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                          isRead ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-[12.5px] ${
                            isRead ? "text-muted-foreground" : "font-semibold text-foreground"
                          }`}
                        >
                          {n.title}
                        </div>
                        {n.description && (
                          <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                            {n.description}
                          </div>
                        )}
                        <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      {!isRead && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
