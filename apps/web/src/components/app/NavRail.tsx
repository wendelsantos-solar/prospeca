import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";
import { useLeadStageCounts, useTodayCounts } from "@/hooks/useLeadsQuery";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { LogoMark } from "@/components/shared/LogoMark";
import { UserMenu } from "./UserMenu";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/app/mapa", label: "Descobrir", icon: icons.navigation.map },
  { to: "/app/hoje", label: "Hoje", icon: icons.navigation.today },
  { to: "/app/kanban", label: "Pipeline", icon: icons.navigation.pipeline },
  { to: "/app/painel", label: "Análises", icon: icons.navigation.analytics },
];

/**
 * Primary navigation rail (Fase 2 UI — Layout Shell).
 *
 * Modo EXPANDED: ícone + label (mockup). Modo COLLAPSED: só ícones, largura
 * mínima, TOOLTIP em cada item. Toggle sempre visível e óbvio.
 *
 * DECISÃO (P3-4): 'auto' = default responsivo (>=1536 expandida, <1536
 * colapsada). Vale na primeira visita E enquanto o usuário nunca tocar no
 * toggle (não há preferência salva). O primeiro clique grava preferência
 * explícita persistida e, a partir daí, a escolha do usuário manda em
 * qualquer viewport — o default responsivo não sobrescreve escolha.
 *
 * Transição do colapso: 150ms, desativada com prefers-reduced-motion (P3-3).
 * REGRA DURA: nunca esconder navegação sem forma simples de restaurar — o
 * toggle vive fixo no rail e tem aria-expanded.
 */
export function NavRail() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const isPlatformAdmin = useIsPlatformAdmin();
  const navMode = useUIStore((s) => s.navMode);
  const setNavMode = useUIStore((s) => s.setNavMode);
  const isWide = useMediaQuery("(min-width: 1536px)");

  // Defesa de hidratação (Fase 6b): valor fora do contrato (blob antigo sem
  // navMode ou corrompido) cai em 'auto' — nunca num estado travado. O
  // migrate do store já normaliza; esta linha é a rede de segurança no render.
  const mode = navMode === "expanded" || navMode === "collapsed" ? navMode : "auto";

  const expanded = mode === "expanded" || (mode === "auto" && isWide);

  const toggleNav = () => {
    // Alterna a preferência EXPLÍCITA a partir do estado efetivo atual.
    setNavMode(expanded ? "collapsed" : "expanded");
  };

  // P1-a: contagens de badge vêm do SERVIDOR — nunca de length de array
  // carregado (o teto silencioso de 50 voltava no badge da navegação).
  const { data: stageCounts } = useLeadStageCounts();
  const { data: todayCounts } = useTodayCounts();
  const pipelineCount = stageCounts?.total ?? 0;

  const { todayCount, overdueCount } = useMemo(() => {
    const today = todayCounts?.today ?? 0;
    const overdue = todayCounts?.overdue ?? 0;
    const firstReach = todayCounts?.firstReach ?? 0;
    return { todayCount: today + overdue + firstReach, overdueCount: overdue };
  }, [todayCounts]);

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
      className={cn(
        "hidden lg:flex shrink-0 flex-col border-r border-border bg-surface py-3.5 transition-[width] duration-150 motion-reduce:transition-none",
        expanded ? "w-[190px] px-2" : "w-16 items-center",
      )}
    >
      <div
        className={cn("flex items-center", expanded ? "justify-between px-2" : "justify-center")}
      >
        <Link
          to="/app/mapa"
          aria-label="Prospeca — início"
          className="mb-0 grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-card"
        >
          <LogoMark className="h-5 w-5" />
        </Link>
        {expanded && (
          <button
            onClick={toggleNav}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Recolher navegação"
            aria-expanded={expanded}
            title="Recolher navegação"
          >
            <AppIcon icon={icons.layout.collapseSidebar} size="md" tone="inherit" decorative />
          </button>
        )}
      </div>

      <div
        className={cn("mt-3.5 flex flex-1 gap-1", expanded ? "flex-col" : "flex-col items-center")}
      >
        {nav.map((item) => {
          const active = path === item.to || path.startsWith(`${item.to}/`);
          const Icon = item.icon;
          const { count, tone } = countFor(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center rounded-xl transition-colors duration-150",
                expanded ? "w-full gap-3 px-3" : "w-11 justify-center",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-primary" />
              )}
              <AppIcon
                icon={Icon}
                size="lg"
                tone={active ? "primary" : "muted"}
                stroke={active ? "strong" : "regular"}
                decorative
              />
              {expanded && <span className="truncate text-[13px] font-medium">{item.label}</span>}
              {count > 0 && (
                <span
                  className={cn(
                    "absolute grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-surface px-1 text-[10px] font-bold leading-none tabular-nums text-white",
                    expanded ? "right-2 top-2.5" : "right-1 top-1",
                    tone === "danger" ? "bg-destructive" : "bg-primary",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
          return expanded ? (
            link
          ) : (
            <TooltipProvider key={`tip-${item.to}`} delayDuration={200}>
              <UiTooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="z-50">
                  {item.label}
                </TooltipContent>
              </UiTooltip>
            </TooltipProvider>
          );
        })}
      </div>

      <div className={cn("flex gap-1", expanded ? "flex-col px-1" : "flex-col items-center")}>
        {!expanded && (
          <button
            onClick={toggleNav}
            className="mb-1 grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
            aria-label="Expandir navegação"
            aria-expanded={expanded}
            title="Expandir navegação"
          >
            <AppIcon icon={icons.layout.expandSidebar} size="md" tone="inherit" decorative />
          </button>
        )}
        {/* Rodapé do mockup: Workspace + usuário (UserMenu expandido) — dados
         * REAIS do tenant/logado; o menu da conta inteiro segue acessível. */}
        <UserMenu className={cn(expanded ? "mt-1 w-full" : "mt-1")} expanded={expanded} />
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          className={cn(
            "grid h-11 items-center rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground",
            expanded ? "w-full gap-3 px-3" : "w-11 justify-center",
          )}
        >
          <AppIcon
            icon={theme === "dark" ? icons.theme.light : icons.theme.dark}
            size="md"
            tone="inherit"
            decorative
          />
          {expanded && <span className="text-[13px] font-medium">Tema</span>}
        </button>
      </div>
    </nav>
  );
}
