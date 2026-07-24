import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Map as MapIcon,
  Kanban,
  BarChart3,
  ShieldCheck,
  PanelLeftOpen,
  Sunrise,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { buildTodayGroups } from "@/lib/today";
import { NotificationsPopover } from "./NotificationsPopover";

const TABS = [
  { to: "/app/mapa", label: "Mapa", icon: MapIcon },
  { to: "/app/hoje", label: "Hoje", icon: Sunrise },
  { to: "/app/kanban", label: "Pipeline", icon: Kanban },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/painel", label: "Análises", icon: BarChart3 },
] as const;

export function TopNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const isPlatformAdmin = useIsPlatformAdmin();

  const { data } = useLeadsList({ quick: [] });
  const items = useMemo(() => data?.items ?? [], [data]);
  const pipelineCount = items.length;

  const { todayCount, overdueCount } = useMemo(() => {
    const groups = buildTodayGroups(items);
    const today = groups.find((g) => g.id === "today")?.items.length ?? 0;
    const overdue = groups.find((g) => g.id === "overdue")?.items.length ?? 0;
    const firstReach = groups.find((g) => g.id === "first_reach")?.items.length ?? 0;
    return { todayCount: today + overdue + firstReach, overdueCount: overdue };
  }, [items]);

  const tabs = isPlatformAdmin
    ? [...TABS, { to: "/app/admin", label: "Administração", icon: ShieldCheck } as const]
    : TABS;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-surface px-3">
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Expandir painel lateral"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}
      <nav className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted/60 p-1">
        {tabs.map((t) => {
          const active = path === t.to || path.startsWith(`${t.to}/`);
          const Icon = t.icon;
          let count = 0;
          let tone: "default" | "danger" = "default";
          if (t.to === "/app/kanban") count = pipelineCount;
          if (t.to === "/app/hoje") {
            count = todayCount;
            if (overdueCount > 0) tone = "danger";
          }
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "ml-1 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold",
                    tone === "danger"
                      ? "bg-destructive/15 text-destructive"
                      : active
                        ? "bg-primary-soft text-primary"
                        : "bg-surface text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
        <NotificationsPopover />
      </div>
    </header>
  );
}
