import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBillingPlans, formatPriceCents, type BillingPlan } from "@/lib/billing-plans";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "3 buscas por mês",
    "15 leads processados",
    "Pipeline básico",
    "Modelos de mensagem",
    "Sem cartão de crédito",
  ],
  professional: [
    "30 buscas por mês",
    "200 leads processados",
    "Pipeline completo",
    "Exportação CSV",
    "Suporte prioritário",
  ],
  agency: [
    "100 buscas por mês",
    "800 leads processados",
    "Até 5 usuários",
    "Múltiplos pipelines",
    "Relatórios por usuário",
  ],
};

function PricingCard({ plan, highlighted }: { plan: BillingPlan; highlighted?: boolean }) {
  const features = PLAN_FEATURES[plan.code] ?? [];
  const isFree = plan.monthlyPriceCents === 0;
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-6",
        highlighted
          ? "border-primary bg-surface shadow-card ring-1 ring-primary/20"
          : "border-border bg-surface",
      )}
    >
      {highlighted && (
        <span className="mb-3 w-fit rounded-full bg-primary-soft px-3 py-0.5 text-xs font-semibold text-primary">
          Mais escolhido
        </span>
      )}
      <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{plan.description ?? ""}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">
          {formatPriceCents(plan.monthlyPriceCents)}
        </span>
        {!isFree && plan.monthlyPriceCents !== null && (
          <span className="text-sm text-muted-foreground">/mês</span>
        )}
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button
          className="w-full"
          variant={highlighted ? "default" : "outline"}
          asChild
          onClick={() => track("plan_selected", { plan: plan.code })}
        >
          <Link to="/cadastro" search={{ plan: plan.code }}>
            {isFree ? "Começar grátis" : "Testar grátis"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function PricingTeaser() {
  const { data: plans } = useQuery({ queryKey: ["billing-plans"], queryFn: fetchBillingPlans });
  const shown = (plans ?? []).filter((p) => ["free", "professional", "agency"].includes(p.code));
  return (
    <MarketingSection id="recursos" spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Preços"
          title="Um plano pra cada estágio da sua prospecção"
          description="Comece de graça. Faça upgrade quando fizer sentido."
          center
        />
        {shown.length > 0 && (
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {shown.map((plan) => (
              <PricingCard key={plan.code} plan={plan} highlighted={plan.code === "professional"} />
            ))}
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <Button variant="outline" asChild>
            <Link to="/precos">
              Ver todos os planos e comparação completa
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
