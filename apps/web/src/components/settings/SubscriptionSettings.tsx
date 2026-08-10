import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight } from "lucide-react";
import { fetchCurrentSubscription } from "@/lib/account";
import { SalesContactForm } from "@/components/marketing/SalesContactForm";
import { AppIcon } from "@/design-system/icons/AppIcon";
import { icons } from "@/design-system/icons/icon-registry";

function PlanSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

export function SubscriptionSettings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: fetchCurrentSubscription,
  });

  if (isLoading) return <PlanSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 px-6 text-center" role="alert">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AppIcon icon={icons.feedback.warning} size="xl" tone="inherit" decorative />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Não foi possível carregar o plano</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">Verifique sua conexão.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <CreditCard className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground">Nenhum plano encontrado.</p>
      </div>
    );
  }

  const limitEntries = Object.entries(data.limits).filter(([k]) => k !== "");

  return (
    <div className="space-y-6">
      {/* Plano atual */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-foreground">{data.planName}</div>
              <span className="mt-0.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {data.status === "free"
                  ? "Gratuito"
                  : data.status === "active"
                    ? "Ativo"
                    : data.status}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/precos">
              Ver planos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {(data.currentPeriodEnd || limitEntries.length > 0) && (
          <div className="border-t border-border px-4 py-3">
            {data.currentPeriodEnd && (
              <p className="mb-3 text-[12px] text-muted-foreground">
                Renova em {new Date(data.currentPeriodEnd).toLocaleDateString("pt-BR")}
                {data.cancelAtPeriodEnd && " — cancelamento agendado"}
              </p>
            )}
            {limitEntries.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {limitEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border bg-surface-2/60 p-2.5 text-center"
                  >
                    <div className="text-[16px] font-semibold tabular-nums text-foreground">
                      {value === -1 ? "∞" : value.toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{key}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contato comercial */}
      <div className="flex items-center gap-2 px-1">
        <p className="text-[11px] text-muted-foreground">Sem checkout automático.</p>
        <SalesContactForm
          source="configuracoes_plano"
          trigger={
            <button className="text-[11px] font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
              Falar com a gente
            </button>
          }
        />
      </div>
    </div>
  );
}
