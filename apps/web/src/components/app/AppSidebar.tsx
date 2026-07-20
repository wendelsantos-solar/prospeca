import { useMemo, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Radar,
  Moon,
  Sun,
  MapIcon,
  LayoutGrid,
  BarChart3,
  FileDown,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore, useLeadsStore, applyPresenceFilter } from "@/stores";
import { useLeadsList } from "@/hooks/useLeadsQuery";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { SearchForm } from "./SearchForm";
import { QuickFilters, SortSelect, AdvancedFilters } from "./Filters";
import { LeadCard } from "./LeadCard";
import { MessageTemplateDialog } from "./MessageTemplateDialog";
import { HistoryDrawer } from "./HistoryDrawer";
import { SettingsDialog } from "./SettingsDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LeadListSkeleton, SummarySkeleton } from "@/components/shared/Skeletons";
import { applyFilters, sortLeads } from "@/lib/filters";
import { exportCSV, exportExcel } from "@/lib/export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BulkBar } from "./BulkBar";

export function AppSidebar({ mobile }: { mobile?: boolean }) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  const searching = useLeadsStore((s) => s.searching);
  const searchError = useLeadsStore((s) => s.searchError);
  const setSearchError = useLeadsStore((s) => s.setSearchError);
  const filters = useLeadsStore((s) => s.filters);
  const sort = useLeadsStore((s) => s.sort);
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const focusedId = useLeadsStore((s) => s.focusedId);

  // CRM real — leads from TanStack Query (Phase 3)
  const { data } = useLeadsList(filters, sort);
  const leads = useMemo(() => data?.items ?? [], [data]);

  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const filtered = useMemo(
    () => sortLeads(applyFilters(leads, filters), sort),
    [leads, filters, sort],
  );

  const summary = useMemo(() => {
    if (!leads.length) return null;
    // Single-pass aggregation instead of 6 separate .filter() calls
    let noSite = 0;
    let enriched = 0;
    let wa = 0;
    let emails = 0;
    let phones = 0;
    for (const l of leads) {
      if (!l.hasWebsite) noSite++;
      if (l.whatsapp) wa++;
      if (l.email) emails++;
      if (l.phone) phones++;
      if (l.phone || l.whatsapp || l.email) enriched++;
    }
    return {
      noSite,
      withSite: leads.length - noSite,
      enriched,
      wa,
      emails,
      phones,
      total: leads.length,
    };
  }, [leads]);

  const tabs = [
    { to: "/app/mapa", icon: MapIcon, label: "Mapa", count: filtered.length },
    {
      to: "/app/kanban",
      icon: LayoutGrid,
      label: "Kanban",
      count: filtered.filter((l) => l.stage !== "discarded").length,
    },
    { to: "/app/painel", icon: BarChart3, label: "Painel", count: undefined },
  ];

  if (collapsed && !mobile) {
    return (
      <aside className="hidden md:flex w-14 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center justify-center border-b">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setCollapsed(false)}
            aria-label="Expandir painel lateral"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <TooltipProvider>
          <nav className="flex flex-col items-center gap-1 py-3">
            {tabs.map((t) => {
              const active = pathname === t.to;
              return (
                <Tooltip key={t.to}>
                  <TooltipTrigger asChild>
                    <Link
                      to={t.to}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-md",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                      aria-label={t.label}
                    >
                      <t.icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {t.label}
                    {t.count != null ? ` (${t.count})` : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar",
        mobile
          ? "h-full w-full"
          : "hidden md:flex w-full max-w-[360px] xl:max-w-[400px] shrink-0 border-r",
      )}
    >
      <header className="flex items-center gap-2 border-b p-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-elegant">
          <Radar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="truncate text-[10px] text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={toggleTheme}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <SettingsDialog />
        {!mobile && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hidden md:flex"
            onClick={() => setCollapsed(true)}
            aria-label="Recolher painel lateral"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="border-b p-3">
          <SearchForm />
        </div>

        <nav className="border-b p-2" aria-label="Navegação principal">
          <div className="grid grid-cols-3 gap-1">
            {tabs.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-md py-2 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className="absolute right-1.5 top-1 rounded-full bg-muted px-1 text-[9px] font-semibold tabular-nums text-muted-foreground">
                      {t.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-b p-3 space-y-2">
          <MessageTemplateDialog />
          <HistoryDrawer />
        </div>

        {searching ? (
          <SummarySkeleton />
        ) : summary ? (
          <div className="border-b bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-foreground">
              <b className="text-hot tabular-nums">{summary.noSite}</b> sem site, de{" "}
              <b className="tabular-nums">{summary.total}</b> empresas encontradas
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <b className="text-foreground tabular-nums">{summary.enriched}</b> de {summary.total}{" "}
              leads enriquecidos
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
              <MiniStat label="WhatsApp" value={summary.wa} />
              <MiniStat label="Telefones" value={summary.phones} />
              <MiniStat label="E-mails" value={summary.emails} />
            </div>
          </div>
        ) : null}

        <div className="border-b p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <SortSelect />
            <AdvancedFilters />
          </div>
          <QuickFilters />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs gap-1"
              disabled={filtered.length === 0}
              onClick={() => {
                try {
                  exportCSV(filtered);
                  toast.success(`CSV exportado (${filtered.length} leads)`);
                } catch {
                  toast.error("Falha ao exportar CSV");
                }
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs gap-1"
              disabled={filtered.length === 0}
              onClick={() => {
                try {
                  exportExcel(filtered);
                  toast.success(`Excel exportado (${filtered.length} leads)`);
                } catch {
                  toast.error("Falha ao exportar Excel");
                }
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>

        <BulkBar
          visibleIds={filtered.map((l) => l.id)}
          onOpenPrepare={() => window.dispatchEvent(new CustomEvent("open-bulk-messages"))}
        />

        <div className="p-2">
          {searching ? (
            <LeadListSkeleton />
          ) : searchError ? (
            <ErrorState
              title="Falha na busca"
              description={searchError}
              onRetry={() => window.dispatchEvent(new CustomEvent("retry-search"))}
              onBack={() => setSearchError(null)}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum lead"
              description="Ajuste os filtros ou faça uma nova busca."
            />
          ) : (
            <Virtuoso
              totalCount={filtered.length}
              useWindowScroll={false}
              itemContent={(index) => {
                const l = filtered[index];
                return (
                  <div className="px-0.5 py-0.5">
                    <LeadCard
                      lead={l}
                      bulk={bulkMode}
                      isSelected={selectedIds.includes(l.id)}
                      isFocused={focusedId === l.id}
                    />
                  </div>
                );
              }}
              style={{ height: `${Math.max(filtered.length * 140, 200)}px` }}
            />
          )}
        </div>
      </div>
      {/* fecha o scroll wrapper */}
    </aside>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface border p-1.5">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export { applyPresenceFilter };
