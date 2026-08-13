import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { buildTodayGroups } from "@/lib/today";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { LogoMark } from "@/components/shared/LogoMark";
import { UserMenu } from "./UserMenu";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/app/mapa", label: "Mapa", icon: icons.navigation.map },
  { to: "/app/hoje", label: "Hoje", icon: icons.navigation.today },
  { to: "/app/kanban", label: "Pipeline", icon: icons.navigation.pipeline },
  { to: "/app/painel", label: "Análises", icon: icons.navigation.analytics },
];

/** Primary navigation rail (64px). Holds the brand, the top-level destinations
 * with unread/count badges, and the utility cluster (theme, settings, user).
 * Contextual search lives in AppSidebar; global context lives in TopNav. */
export function NavRail() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
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

  const nav = isPlatformAdmin
    ? [...NAV, { to: "/app/admin", label: "Administração", icon: icons.navigation.administration }]
    : NAV;

  const countFor = (to: string) => {
    if (to === "/app/kanban") return { count: pipelineCount, tone: "default" as const };
    if (to === "/app/hoje")
      return {
        count: todayCount,
        tone: overdueCount > 0 ? ("danger" as const) : ("default" as const),
      };
    return { count: 0, tone: "default" as const };
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="hidden lg:flex w-16 shrink-0 flex-col items-center border-r border-border bg-surface py-3.5"
    >
      <Link
        to="/app/mapa"
        aria-label="Prospeca — início"
        className="mb-3.5 grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-card"
      >
        <LogoMark className="h-5 w-5" />
      </Link>

      <div className="flex flex-1 flex-col items-center gap-1">
        {nav.map((item) => {
          const active = path === item.to || path.startsWith(`${item.to}/`);
          const Icon = item.icon;
          const { count, tone } = countFor(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              title={item.label}
              className={cn(
                "group relative grid h-11 w-11 place-items-center rounded-xl transition-colors duration-150",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute -left-3.5 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-primary" />
              )}
              <AppIcon
                icon={Icon}
                size="lg"
                tone={active ? "primary" : "muted"}
                stroke={active ? "strong" : "regular"}
                decorative
              />
              {count > 0 && (
                <span
                  className={cn(
                    "absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-surface px-1 text-[10px] font-bold leading-none tabular-nums text-white",
                    tone === "danger" ? "bg-destructive" : "bg-primary",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
        >
          <AppIcon
            icon={theme === "dark" ? icons.theme.light : icons.theme.dark}
            size="md"
            tone="inherit"
            decorative
          />
        </button>
        <UserMenu className="mt-1" />
      </div>
    </nav>
  );
}
