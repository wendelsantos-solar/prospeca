import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useSearchDraftStore, useLeadsStore } from "@/stores";
import { NotificationsPopover } from "./NotificationsPopover";
import { CommandPalette } from "./CommandPalette";
import { FeedbackForm } from "./FeedbackForm";
import { UserMenu } from "./UserMenu";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";
import { getSearchRepository } from "@/repositories";
import { toast } from "sonner";

/** Page titles for the header context when there is no active search to show. */
const PAGE_TITLES: Record<string, string> = {
  "/app/mapa": "Descobrir",
  "/app/hoje": "Hoje",
  "/app/kanban": "Pipeline",
  "/app/agenda": "Agenda",
  "/app/painel": "Análises",
  "/app/admin": "Administração",
  "/app/historico": "Histórico",
  "/app/configuracoes": "Configurações",
};

/** Global header: panel toggle, current context (search or page), the ⌘K search
 * affordance, and notifications. Primary navigation lives in the NavRail. */
export function TopNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const niche = useSearchDraftStore((s) => s.draft.niche);
  const location = useSearchDraftStore((s) => s.draft.location);
  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  const hasSearch = currentSearch != null;

  const [paletteOpen, setPaletteOpen] = useState(false);

  const onMapa = path === "/app/mapa";
  const showSearchContext = onMapa && hasSearch && location.trim().length > 0;
  const pageTitle = PAGE_TITLES[path] ?? "Prospeca";

  // ⌘K / Ctrl+K opens the global command palette (jump to pages, start a search).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fase remoção: o mockup NÃO tem barra superior na descoberta — a primeira
  // linha são os KPIs. O TopNav permanece GLOBAL (Hoje/Pipeline/Análises/…);
  // só é oculto NA rota /app/mapa. (Early return APÓS os hooks.)
  if (onMapa) return null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:grid"
        aria-label={sidebarCollapsed ? "Mostrar painel de busca" : "Ocultar painel de busca"}
        title={sidebarCollapsed ? "Mostrar painel" : "Ocultar painel"}
      >
        {sidebarCollapsed ? (
          <AppIcon icon={icons.layout.expandSidebar} size="lg" tone="inherit" decorative />
        ) : (
          <AppIcon icon={icons.layout.collapseSidebar} size="lg" tone="inherit" decorative />
        )}
      </button>

      {/* Context */}
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {showSearchContext ? (
          <>
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <AppIcon icon={icons.lead.location} size="xs" tone="primary" decorative />
            </span>
            <span className="truncate text-muted-foreground">{location}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-semibold text-foreground">
              {niche ? `${niche} · ${radiusKm} km` : `${radiusKm} km`}
            </span>
            <button
              onClick={async () => {
                if (!currentSearch) return;
                const name = window.prompt(
                  "Nome para salvar esta missão de prospecção:",
                  currentSearch.niche,
                );
                if (name == null) return;
                try {
                  await getSearchRepository().saveSearch(currentSearch.id, name);
                  toast.success("Busca salva como missão");
                } catch {
                  toast.error("Não foi possível salvar a busca");
                }
              }}
              aria-label="Salvar busca como missão"
              title="Salvar busca como missão"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="truncate font-semibold text-foreground">{pageTitle}</span>
        )}
      </div>

      {/* Global command palette trigger */}
      <button
        onClick={() => setPaletteOpen(true)}
        className={cn(
          "ml-auto hidden h-9 max-w-[320px] flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong lg:flex",
        )}
        aria-label="Abrir busca de comandos (atalho: Ctrl+K)"
      >
        <AppIcon icon={icons.actions.search} size="sm" tone="inherit" decorative />
        <span className="truncate">Buscar páginas, nichos…</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Compact trigger for small headers */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
        aria-label="Abrir busca de comandos"
      >
        <AppIcon icon={icons.actions.search} size="lg" tone="inherit" decorative />
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
        >
          <AppIcon
            icon={theme === "dark" ? icons.theme.light : icons.theme.dark}
            size="lg"
            tone="inherit"
            decorative
          />
        </button>
        <FeedbackForm currentPage={path} />
        <NotificationsPopover />
        <UserMenu className="lg:hidden" />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
