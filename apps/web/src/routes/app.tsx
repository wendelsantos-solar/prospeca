import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app/AppSidebar";
import { useLeadsStore } from "@/stores";
import { LeadDetailsDrawer } from "@/components/app/LeadDetailsDrawer";
import { BulkMessageDialog } from "@/components/app/BulkBar";
import { WonDialog, DiscardDialog } from "@/components/app/StageDialogs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MapIcon, LayoutGrid, BarChart3, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useThemeSync } from "@/hooks/useThemeSync";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode, isRealMode, realConfigMissing } from "@/lib/env";

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

/** Real mode: requires session; redirects to /login. Demo mode: open. */
function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isRealMode && !auth.loading && !auth.isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [auth.loading, auth.isAuthenticated, navigate]);

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
  const tabs = [
    { to: "/app/mapa", icon: MapIcon, label: "Mapa" },
    { to: "/app/kanban", icon: LayoutGrid, label: "Kanban" },
    { to: "/app/painel", icon: BarChart3, label: "Painel" },
  ];
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
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
  const [bulkOpen, setBulkOpen] = useState(false);

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

  return (
    <AuthGate>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-hidden pb-14 md:pb-0">
          <Outlet />
        </main>
        <MobileNav />
        <LeadDetailsDrawer />
        <BulkMessageDialog open={bulkOpen} onOpenChange={setBulkOpen} />
        <WonDialog />
        <DiscardDialog />
        <DemoModeBanner />
      </div>
    </AuthGate>
  );
}
