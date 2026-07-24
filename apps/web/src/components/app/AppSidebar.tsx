import { useMemo, useEffect, useRef } from "react";
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
  Phone,
  Check,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore, useLeadsStore, useSearchDraftStore } from "@/stores";
import { useDiscoveryResults, useLeadsList } from "@/hooks/useLeadsQuery";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { APP_NAME, APP_TAGLINE, RADIUS_OPTIONS } from "@/lib/constants";
import { SearchForm } from "./SearchForm";
import { DiscoveryCard } from "./DiscoveryCard";
import { MessageTemplateDialog } from "./MessageTemplateDialog";
import { HistoryDrawer } from "./HistoryDrawer";
import { SettingsDialog } from "./SettingsDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LeadListSkeleton, SummarySkeleton } from "@/components/shared/Skeletons";
import { filterByRadius } from "@/lib/filters";
import { exportDiscoveryCSV } from "@/lib/export";
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
  const radiusKm = useSearchDraftStore((s) => s.draft.radiusKm);
  const draftCoords = useSearchDraftStore((s) => s.draft.coords);
  const setDraft = useSearchDraftStore((s) => s.setDraft);
  const isAreaTooLargeError = !!searchError?.toLowerCase().includes("raio");
  const smallerRadius = [...RADIUS_OPTIONS].reverse().find((r) => r < radiusKm);
  const currentSearch = useLeadsStore((s) => s.currentSearch);
  // The radius slider filters the already-loaded results around the committed
  // search center — NOT draftCoords, which also tracks map pan/zoom (see
  // MapView's syncCenterToDraft) and would silently empty the list on a pan.
  const radiusCenter = currentSearch
    ? { lat: currentSearch.latitude, lng: currentSearch.longitude }
    : draftCoords;
  const bulkMode = useLeadsStore((s) => s.bulkMode);
  const focusedId = useLeadsStore((s) => s.focusedId);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Discovery list: results of the current search (search_results ⋈ places),
  // NOT the org's accumulated leads. A lead only exists once added to the funnel.
  const { data: discovery } = useDiscoveryResults(currentSearch?.id);
  const results = useMemo(() => discovery ?? [], [discovery]);

  // Funnel size for the Kanban nav badge — leads (materialized funnel), NOT
  // discovery. Distinct from the Mapa badge, which counts search results.
  const leadFilters = useLeadsStore((s) => s.filters);
  const leadSort = useLeadsStore((s) => s.sort);
  const { data: funnelLeads } = useLeadsList(leadFilters, leadSort);

  // A map marker click focuses a result but the list has no reason to react on
  // its own — without this the selected card can be scrolled off-screen with
  // no visible feedback that anything changed. Card clicks don't need this:
  // the card is already in view.
  useEffect(() => {
    const onFocusFromMap = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const el = scrollAreaRef.current?.querySelector(`[data-place-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("lead-focused-from-map", onFocusFromMap);
    return () => window.removeEventListener("lead-focused-from-map", onFocusFromMap);
  }, []);

  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Radius is a hard filter, not a dimmed preview — map, list, and counts must
  // all agree on what "inside the radius" means (matches reference product).
  const resultsInRadius = useMemo(
    () => filterByRadius(results, radiusCenter, radiusKm),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on lat/lng primitives to avoid object-ref churn
    [results, radiusCenter.lat, radiusCenter.lng, radiusKm],
  );

  const summary = useMemo(() => {
    if (!resultsInRadius.length) return null;
    let noSite = 0;
    let phones = 0;
    let inFunnel = 0;
    for (const r of resultsInRadius) {
      if (!r.hasWebsite) noSite++;
      if (r.phone) phones++;
      if (r.importedLeadId != null) inFunnel++;
    }
    return {
      noSite,
      phones,
      inFunnel,
      // Denominador = o que existe de fato na lista/mapa (dentro do raio real),
      // não o found_count bruto do provider (inclui cantos da bbox fora do
      // círculo, que foram descartados no execute-search e não são navegáveis).
      // Mapa, lista e este contador têm que concordar. found_count segue no
      // Histórico, onde é métrica de auditoria da busca.
      total: resultsInRadius.length,
    };
  }, [resultsInRadius]);

  const isPlatformAdmin = useIsPlatformAdmin();
  const tabs = [
    { to: "/app/mapa", icon: MapIcon, label: "Mapa", count: resultsInRadius.length },
    { to: "/app/kanban", icon: LayoutGrid, label: "Kanban", count: funnelLeads?.total },
    { to: "/app/painel", icon: BarChart3, label: "Painel", count: undefined },
    ...(isPlatformAdmin
      ? [{ to: "/app/admin", icon: Shield, label: "Admin", count: undefined }]
      : []),
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

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto">
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
              <b className="tabular-nums">{summary.total}</b> encontradas
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
              <ChannelStat icon={Phone} label="Com telefone" value={summary.phones} />
              <ChannelStat icon={Check} label="No funil" value={summary.inFunnel} />
            </div>
          </div>
        ) : null}

        <div className="border-b p-3">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs gap-1"
              disabled={resultsInRadius.length === 0}
              onClick={() => {
                try {
                  exportDiscoveryCSV(resultsInRadius);
                  toast.success(`CSV exportado (${resultsInRadius.length} empresas)`);
                } catch {
                  toast.error("Falha ao exportar CSV");
                }
              }}
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        <BulkBar
          visibleIds={resultsInRadius.map((r) => r.placeId)}
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
              onSecondary={
                isAreaTooLargeError && smallerRadius
                  ? () => {
                      setDraft({ radiusKm: smallerRadius });
                      window.dispatchEvent(new CustomEvent("retry-search"));
                    }
                  : undefined
              }
              secondaryLabel={
                smallerRadius ? `Reduzir raio para ${smallerRadius}km e tentar` : undefined
              }
              onBack={() => setSearchError(null)}
            />
          ) : resultsInRadius.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma empresa"
              description="Faça uma busca ou aumente o raio."
            />
          ) : (
            <Virtuoso
              totalCount={resultsInRadius.length}
              useWindowScroll={false}
              itemContent={(index) => {
                const r = resultsInRadius[index];
                return (
                  <div className="px-0.5 py-0.5" data-place-id={r.placeId}>
                    <DiscoveryCard result={r} searchId={currentSearch?.id ?? ""} />
                  </div>
                );
              }}
              style={{ height: `${Math.max(resultsInRadius.length * 120, 200)}px` }}
            />
          )}
        </div>
      </div>
      {/* fecha o scroll wrapper */}
    </aside>
  );
}

function ChannelStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border bg-surface px-1.5 py-0.5 text-muted-foreground"
      aria-label={`${label}: ${value}`}
    >
      <Icon className="h-3 w-3" />
      <b className="font-semibold tabular-nums text-foreground">{value}</b>
    </span>
  );
}
