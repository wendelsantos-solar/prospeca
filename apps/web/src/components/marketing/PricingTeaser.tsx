import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBillingPlans, formatPriceCents } from "@/lib/billing-plans";
import { Section, SectionHeading } from "./Section";

export function PricingTeaser() {
  const { data: plans } = useQuery({ queryKey: ["billing-plans"], queryFn: fetchBillingPlans });
  const shown = (plans ?? []).filter((p) => ["free", "professional", "agency"].includes(p.code));

  return (
    <Section id="recursos">
      <SectionHeading eyebrow="Preços" title="Um plano pra cada estágio da sua prospecção" center />
      {shown.length > 0 && (
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
          {shown.map((plan) => (
            <div
              key={plan.code}
              className="rounded-xl border border-border bg-surface p-5 text-center"
            >
              <div className="text-sm font-semibold text-foreground">{plan.name}</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {formatPriceCents(plan.monthlyPriceCents)}
              </div>
              {plan.monthlyPriceCents !== null && plan.monthlyPriceCents > 0 && (
                <div className="text-xs text-muted-foreground">/mês</div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 flex justify-center">
        <Button variant="outline" asChild>
          <Link to="/precos">
            Ver todos os planos e comparação completa
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
