import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PanelLeftOpen, PanelLeftClose, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useSearchDraftStore, useLeadsStore } from "@/stores";
import { useSearchSession } from "@/stores/searchSession";
import { NotificationsPopover } from "./NotificationsPopover";

/** Page titles for the header context when there is no active search to show. */
const PAGE_TITLES: Record<string, string> = {
  "/app/mapa": "Mapa",
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

  const niche = useSearchDraftStore((s) => s.draft.niche);
  const location = useSearchDraftStore((s) => s.draft.location);
  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const hasSearch = useLeadsStore((s) => s.currentSearch) != null;

  const onMapa = path === "/app/mapa";
  const showSearchContext = onMapa && hasSearch && location.trim().length > 0;
  const pageTitle = PAGE_TITLES[path] ?? "Radar Local";

  // ⌘K / Ctrl+K focuses the discovery search (the search panel owns the field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (sidebarCollapsed) setSidebarCollapsed(false);
        useSearchSession.getState().focusNiche();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const focusSearch = () => {
    if (sidebarCollapsed) setSidebarCollapsed(false);
    useSearchSession.getState().focusNiche();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        aria-label={sidebarCollapsed ? "Mostrar painel de busca" : "Ocultar painel de busca"}
        title={sidebarCollapsed ? "Mostrar painel" : "Ocultar painel"}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
      </button>

      {/* Context */}
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {showSearchContext ? (
          <>
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
              <MapPin className="h-[13px] w-[13px]" />
            </span>
            <span className="truncate text-muted-foreground">{location}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-semibold text-foreground">
              {niche ? `${niche} · ${radiusKm} km` : `${radiusKm} km`}
            </span>
          </>
        ) : (
          <span className="truncate font-semibold text-foreground">{pageTitle}</span>
        )}
      </div>

      {/* Global search affordance */}
      <button
        onClick={focusSearch}
        className={cn(
          "ml-auto hidden max-w-[320px] flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong lg:flex",
          "h-9",
        )}
        aria-label="Buscar (atalho: Ctrl+K)"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
        <span className="truncate">Buscar nicho, cidade…</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 lg:ml-0">
        <NotificationsPopover />
      </div>
    </header>
  );
}
