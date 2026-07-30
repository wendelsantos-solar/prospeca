import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import { Section, SectionHeading, Eyebrow } from "./Section";
import { PlanCard } from "./PlanCard";
import { PricingComparison } from "./PricingComparison";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { fetchBillingPlans } from "@/lib/billing-plans";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

export function PricingPage() {
  const [interval, setInterval_] = useState<"monthly" | "annual">("monthly");
  const { data: plans, isLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: fetchBillingPlans,
  });

  useEffect(() => {
    track("pricing_viewed", {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <Section className="pb-8 pt-16 md:pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Preços</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Um plano pra cada estágio da sua prospecção
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Comece de graça. Faça upgrade quando fizer sentido.
          </p>
        </div>

        <div
          className="mx-auto mt-6 grid w-fit grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1"
          role="group"
          aria-label="Ciclo de cobrança"
        >
          {(
            [
              { v: "monthly", l: "Mensal" },
              { v: "annual", l: "Anual — economize até 2 meses" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setInterval_(o.v)}
              aria-pressed={interval === o.v}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                interval === o.v
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          ))}
        </div>

        {!isLoading && plans && (
          <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-3 lg:grid-cols-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                interval={interval}
                highlighted={plan.code === "professional"}
              />
            ))}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-lg text-center text-xs text-muted-foreground">
          Os limites e valores podem ser ajustados durante o período de acesso antecipado.
        </p>
      </Section>

      {plans && (
        <Section muted>
          <SectionHeading title="Comparação completa" center />
          <div className="mt-8">
            <PricingComparison plans={plans} />
          </div>
        </Section>
      )}

      <FounderOffer />
      <FAQSection />
      <MarketingFooter />
    </div>
  );
}
