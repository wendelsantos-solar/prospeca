import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBillingPlans, formatPriceCents, type BillingPlan } from "@/lib/billing-plans";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { SalesContactForm } from "./SalesContactForm";
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
    "Onboarding assistido",
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
        "relative flex flex-col rounded-2xl border p-6",
        highlighted
          ? "border-primary bg-surface shadow-elevated ring-1 ring-primary/30"
          : "border-border bg-surface",
      )}
    >
      {highlighted && (
        <span className="-top-3.5 absolute left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-card">
          Mais popular
        </span>
      )}
      <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
      <p className="mt-1 text-body text-muted-foreground">{plan.description ?? ""}</p>
      <div className="mt-1">
        {!isFree && plan.monthlyPriceCents !== null && (
          <p className="text-[11px] text-muted-foreground">a partir de</p>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-display font-bold text-foreground">
            {formatPriceCents(plan.monthlyPriceCents)}
          </span>
          {!isFree && plan.monthlyPriceCents !== null && (
            <span className="text-body text-muted-foreground">/mês</span>
          )}
        </div>
      </div>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-body text-muted-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {isFree ? (
          <Button
            className="w-full"
            variant={highlighted ? "default" : "outline"}
            asChild
            onClick={() => track("plan_selected", { plan: plan.code })}
          >
            <Link to="/cadastro" search={{ plan: plan.code }}>
              Começar grátis
            </Link>
          </Button>
        ) : (
          <SalesContactForm
            source={`landing_pricing_${plan.code}`}
            trigger={
              <Button
                className="w-full"
                variant={highlighted ? "default" : "outline"}
                onClick={() => track("plan_selected", { plan: plan.code })}
              >
                Solicitar acesso ao piloto
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

export function PricingTeaser() {
  const { data: plans } = useQuery({ queryKey: ["billing-plans"], queryFn: fetchBillingPlans });
  const shown = (plans ?? []).filter((p) => ["free", "professional", "agency"].includes(p.code));
  return (
    <MarketingSection id="precos" spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Preços"
          title={
            <>
              Comece grátis. Evolua quando
              <br />
              sua prospecção pedir.
            </>
          }
          description="Sem cartão no plano grátis. No Profissional, a ativação é assistida e sem contratação automática."
          center
        />
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {shown.map((plan) => (
            <PricingCard key={plan.code} plan={plan} highlighted={plan.code === "professional"} />
          ))}
          {/* Static Enterprise card — always shown as the 3rd option */}
          <div className="relative flex flex-col rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-base font-semibold text-foreground">Empresarial</h3>
            <p className="mt-1 text-body text-muted-foreground">
              Para operações com meta agressiva e times maiores.
            </p>
            <div className="mt-1">
              <p className="text-[11px] text-muted-foreground">a partir de</p>
              <span className="text-[2rem] font-bold tracking-tight text-foreground">
                Personalizado
              </span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5">
              {[
                "Tudo do Profissional",
                "Leads e buscas sob medida",
                "Usuários ilimitados",
                "Onboarding dedicado",
                "Suporte prioritário",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-body text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <SalesContactForm
                source="landing_pricing_enterprise"
                trigger={
                  <Button className="w-full" variant="outline">
                    Falar com vendas
                  </Button>
                }
              />
            </div>
          </div>
        </div>
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
