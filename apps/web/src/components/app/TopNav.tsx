import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PanelLeftOpen, PanelLeftClose, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore, useSearchDraftStore, useLeadsStore } from "@/stores";
import { NotificationsPopover } from "./NotificationsPopover";
import { CommandPalette } from "./CommandPalette";

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

  const [paletteOpen, setPaletteOpen] = useState(false);

  const onMapa = path === "/app/mapa";
  const showSearchContext = onMapa && hasSearch && location.trim().length > 0;
  const pageTitle = PAGE_TITLES[path] ?? "Radar Local";

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

      {/* Global command palette trigger */}
      <button
        onClick={() => setPaletteOpen(true)}
        className={cn(
          "ml-auto hidden h-9 max-w-[320px] flex-1 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong lg:flex",
        )}
        aria-label="Abrir busca de comandos (atalho: Ctrl+K)"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
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
        <Search className="h-[18px] w-[18px]" />
      </button>

      <div className="flex items-center gap-1">
        <NotificationsPopover />
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
