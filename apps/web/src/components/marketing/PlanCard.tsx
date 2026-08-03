import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPriceCents, type BillingPlan } from "@/lib/billing-plans";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

const PLAN_TAGLINE: Record<string, string> = {
  free: "Para testar a plataforma.",
  solo: "Para freelancers e profissionais autônomos.",
  professional: "Piloto fundador com onboarding assistido.",
  agency: "Para pequenas equipes.",
  team: "Recursos e volume sob medida.",
};

const PLAN_CTA_LABEL: Record<string, string> = {
  free: "Começar grátis",
  professional: "Solicitar acesso ao piloto",
};

const LIMIT_LABELS: [key: string, label: string][] = [
  ["users", "usuário(s)"],
  ["processedLeadsPerMonth", "leads processados/mês"],
  ["searchesPerMonth", "buscas/mês"],
];

function formatLimit(value: number): string {
  return value === -1 ? "Ilimitado" : value.toLocaleString("pt-BR");
}

export function PlanCard({
  plan,
  interval,
  highlighted,
}: {
  plan: BillingPlan;
  interval: "monthly" | "annual";
  highlighted?: boolean;
}) {
  const priceCents = interval === "monthly" ? plan.monthlyPriceCents : plan.annualPriceCents;
  const isCustom = priceCents === null;

  return (
    <div
      id={plan.code === "agency" ? "agencia" : undefined}
      className={cn(
        "flex flex-col rounded-xl border p-6",
        highlighted ? "border-primary bg-surface shadow-card" : "border-border bg-surface",
      )}
    >
      {highlighted && (
        <Badge className="mb-3 w-fit" variant="default">
          Mais escolhido
        </Badge>
      )}
      <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {PLAN_TAGLINE[plan.code] ?? plan.description}
      </p>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">{formatPriceCents(priceCents)}</span>
        {!isCustom && priceCents !== 0 && (
          <span className="text-sm text-muted-foreground">
            /{interval === "monthly" ? "mês" : "ano"}
          </span>
        )}
      </div>

      <ul className="mt-5 space-y-2 text-sm">
        {LIMIT_LABELS.map(([key, label]) => (
          <li key={key} className="flex items-center gap-2 text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            {formatLimit(plan.limits[key] ?? 0)} {label}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {plan.code !== "free" ? (
          <SalesContactForm
            source={`pricing_${plan.code}`}
            trigger={
              <Button
                className="w-full"
                variant={highlighted ? "default" : "outline"}
                onClick={() => track("plan_selected", { plan: plan.code })}
              >
                {PLAN_CTA_LABEL[plan.code] ?? "Solicitar acesso"}
              </Button>
            }
          />
        ) : (
          <Button
            className="w-full"
            variant={highlighted ? "default" : "outline"}
            asChild
            onClick={() => track("plan_selected", { plan: plan.code })}
          >
            <Link to="/cadastro" search={{ plan: plan.code }}>
              {PLAN_CTA_LABEL[plan.code] ?? "Começar"}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
