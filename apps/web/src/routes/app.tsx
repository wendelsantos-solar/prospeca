import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { NavRail } from "@/components/app/NavRail";
import { TopNav } from "@/components/app/TopNav";
import { useLeadsStore } from "@/stores";
import { BulkMessageDialog } from "@/components/app/BulkBar";
import { RouteDialog } from "@/components/app/RouteDialog";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";

// Lazy-load heavy dialogs — only download when user actually opens a lead or
// moves a card. LeadDetailsDrawer alone is ~970 lines with notes, activities,
// and opportunity tabs. Stage dialogs are lighter but only used on drag-to-won/discard.
const LeadDetailsDrawer = lazy(() =>
  import("@/components/app/LeadDetailsDrawer").then((m) => ({ default: m.LeadDetailsDrawer })),
);
const WonDialog = lazy(() =>
  import("@/components/app/StageDialogs").then((m) => ({ default: m.WonDialog })),
);
const DiscardDialog = lazy(() =>
  import("@/components/app/StageDialogs").then((m) => ({ default: m.DiscardDialog })),
);
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MapIcon, Sunrise, Kanban, BarChart3, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { OnboardingWizard, type OnboardingProgress } from "@/components/app/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useLeadsRealtimeSubscription } from "@/hooks/useLeadsQuery";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { cn } from "@/lib/utils";
import { useAuth, preserveReturnTo } from "@/hooks/useAuth";
import { usePendingInvitation } from "@/hooks/usePendingInvitation";
import { useTenant } from "@/lib/tenant";
import { setAnalyticsContext } from "@/lib/analytics";
import { isDemoMode, isRealMode, realConfigMissing } from "@/lib/env";
import { useActivationStore } from "@/stores/activation";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function ConfigErrorScreen({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Integração não configurada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O modo real está ativo, mas variáveis obrigatórias estão ausentes. Configure-as e reinicie
          a aplicação. Em desenvolvimento, use <code>VITE_DATA_MODE=demo</code>.
        </p>
        <ul className="mt-4 space-y-1 text-sm font-mono text-destructive">
          {missing.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Real mode: requires session; redirects to /login preserving destination. */
function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();

  useEffect(() => {
    if (isRealMode && !auth.loading && !auth.isAuthenticated) {
      const currentPath = routerState.location.pathname + routerState.location.searchStr;
      preserveReturnTo(currentPath);
      navigate({ to: "/login" });
    }
  }, [
    auth.loading,
    auth.isAuthenticated,
    navigate,
    routerState.location.pathname,
    routerState.location.searchStr,
  ]);

  if (isRealMode) {
    const missing = realConfigMissing();
    if (missing.length > 0) return <ConfigErrorScreen missing={missing} />;
    if (auth.loading) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Verificando sessão...</p>
        </div>
      );
    }
    if (!auth.isAuthenticated) return null;
  }
  return <>{children}</>;
}

function DemoModeBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-full border bg-surface/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur md:bottom-3">
      Modo demonstração — dados fictícios
    </div>
  );
}

function MobileNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  const isPlatformAdmin = useIsPlatformAdmin();
  const tabs = [
    { to: "/app/mapa", icon: MapIcon, label: "Descobrir" },
    { to: "/app/hoje", icon: Sunrise, label: "Hoje" },
    { to: "/app/kanban", icon: Kanban, label: "Pipeline" },
    { to: "/app/painel", icon: BarChart3, label: "Painel" },
    ...(isPlatformAdmin ? [{ to: "/app/admin", icon: ShieldCheck, label: "Admin" }] : []),
  ];
  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      {tabs.map((t) => {
        const active = pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <t.icon className="h-5 w-5" />
            {t.label}
          </Link>
        );
      })}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-auto flex-1 flex-col items-center gap-0.5 rounded-none py-2.5 text-[11px] font-medium text-muted-foreground"
            aria-label="Abrir busca e lista de leads"
          >
            <Search className="h-5 w-5" />
            Buscar
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:max-w-md p-0">
          <SheetTitle className="sr-only">Busca e lista de leads</SheetTitle>
          <SheetDescription className="sr-only">
            Painel de busca com filtros e lista de leads encontrados
          </SheetDescription>
          <AppSidebar mobile />
        </SheetContent>
      </Sheet>
    </nav>
  );
}

function AppLayout() {
  useThemeSync();
  // Painel de descoberta é escopo de /app/mapa — vazava fixo em TODAS as rotas
  // (Hoje/Pipeline), cortando a coluna "Ganho" do Kanban em telas de notebook.
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const onMapa = pathname === "/app/mapa";
  // Supabase Realtime: keeps leads in sync across tabs/devices without polling
  useLeadsRealtimeSubscription();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const onboarding = useOnboarding();
  const onboardingProgress = onboarding.progress;
  const onboardingLoaded = onboarding.loaded;
  const onboardingCompleted = onboarding.isCompleted;
  const saveOnboarding = onboarding.save;
  const configureActivation = useActivationStore((state) => state.configure);
  // Dismissing is local UI state; the wizard itself already persisted
  // completed/skipped via onboarding.save before calling these.
  const [dismissedLocally, setDismissedLocally] = useState(false);
  // Gate on `loaded` (real mode fetches the profile async) so an in-flight
  // request doesn't flash the wizard open for an already-onboarded user.
  const showOnboarding = onboardingLoaded && !onboardingCompleted && !dismissedLocally;

  useEffect(() => {
    if (!onboardingLoaded) return;
    const legacyCompleted =
      onboardingProgress?.completed &&
      !onboardingProgress.searchDraft &&
      !onboardingProgress.milestones;
    const initialMilestones = legacyCompleted
      ? {
          firstSearch: true,
          firstLeadViewed: true,
          firstLeadAdded: true,
          firstMessagePrepared: true,
        }
      : onboardingProgress?.milestones;
    configureActivation(initialMilestones, (milestones) => {
      saveOnboarding({
        step: onboardingProgress?.step ?? 0,
        completed: onboardingProgress?.completed ?? false,
        skippedSteps: onboardingProgress?.skippedSteps ?? [],
        searchDraft: onboardingProgress?.searchDraft,
        milestones,
      });
    });
  }, [configureActivation, onboardingLoaded, onboardingProgress, saveOnboarding]);

  // Consome o convite pendente do cadastro (entra na organização que convidou).
  usePendingInvitation();

  // Contexto de analytics. Sem isto `track()` não persiste nada:
  // usage_events.organization_id é NOT NULL e setAnalyticsContext() não era
  // chamado em lugar nenhum, então todo evento de produto era perdido.
  const { tenant } = useTenant();
  const tenantOrganizationId = tenant?.organizationId;
  const tenantPlan = tenant?.plan;
  useEffect(() => {
    if (tenantOrganizationId) {
      setAnalyticsContext({ organizationId: tenantOrganizationId, plan: tenantPlan });
    }
  }, [tenantOrganizationId, tenantPlan]);

  const handleOnboardingComplete = useCallback((_progress: OnboardingProgress) => {
    setDismissedLocally(true);
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    setDismissedLocally(true);
  }, []);

  // Sync Zustand store → demo repo on first mount (page reload)
  useEffect(() => {
    import("@/repositories").then(({ seedDemoLeads }) => {
      const state = useLeadsStore.getState();
      if (state.leads.length > 0) {
        seedDemoLeads(state.leads);
      }
    });
  }, []);

  useEffect(() => {
    const h = () => setBulkOpen(true);
    window.addEventListener("open-bulk-messages", h);
    return () => window.removeEventListener("open-bulk-messages", h);
  }, []);

  useEffect(() => {
    const h = () => setRouteOpen(true);
    window.addEventListener("open-route-planner", h);
    return () => window.removeEventListener("open-route-planner", h);
  }, []);

  return (
    <AuthGate>
      <ErrorBoundary location="AppLayout">
        <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
          {!onboardingLoaded ? (
            <main className="grid min-h-dvh w-full place-items-center">
              <p className="text-sm text-muted-foreground">Preparando seu workspace…</p>
            </main>
          ) : showOnboarding ? (
            <OnboardingWizard
              onComplete={handleOnboardingComplete}
              onSkip={handleOnboardingSkip}
              initialProgress={onboardingProgress ?? undefined}
              onSaveProgress={saveOnboarding}
            />
          ) : (
            <>
              <NavRail />
              {/* hidden (nao unmount): SearchForm registra _runSearch em
                  useSearchSession no mount — CommandPalette/HistoryDrawer chamam
                  suggestSearch() logo apos navigate({ to: "/app/mapa" }), antes
                  da rota nova montar. Desmontar aqui quebraria essa chamada. */}
              <div className={onMapa ? undefined : "hidden"}>
                <AppSidebar />
              </div>
              <main className="flex flex-1 min-w-0 flex-col overflow-hidden pb-14 lg:pb-0">
                <TopNav />
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Outlet />
                </div>
              </main>
              <MobileNav />
              <Suspense fallback={null}>
                <LeadDetailsDrawer />
              </Suspense>
              <BulkMessageDialog open={bulkOpen} onOpenChange={setBulkOpen} />
              <RouteDialog open={routeOpen} onOpenChange={setRouteOpen} />
              <Suspense fallback={null}>
                <WonDialog />
              </Suspense>
              <Suspense fallback={null}>
                <DiscardDialog />
              </Suspense>
            </>
          )}
          <DemoModeBanner />
        </div>
      </ErrorBoundary>
    </AuthGate>
  );
}
