import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketingPage, MarketingSection, MarketingContainer, Eyebrow } from "./MarketingLayout";
import { PlanCard } from "./PlanCard";
import { PricingComparison } from "./PricingComparison";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { fetchBillingPlans } from "@/lib/billing-plans";
import { track } from "@/lib/analytics";
import { Skeleton } from "@/components/ui/skeleton";

export function PricingPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: fetchBillingPlans,
  });
  useEffect(() => {
    track("pricing_viewed", {});
  }, []);

  return (
    <MarketingPage>
      <MarketingSection spacing="sm" className="pt-24 md:pt-28">
        <MarketingContainer width="default">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Acesso antecipado</Eyebrow>
            <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2.5rem]">
              Comece grátis ou participe do piloto fundador
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              O plano pago tem ativação assistida e escopo transparente enquanto validamos o produto
              com os primeiros clientes.
            </p>
          </div>
          {isLoading && <PricingCardsSkeleton />}
          {!isLoading && plans && (
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  interval="monthly"
                  highlighted={plan.code === "professional"}
                />
              ))}
            </div>
          )}
          <p className="mx-auto mt-6 max-w-lg text-center text-xs text-muted-foreground">
            Sem contratação automática: confirmamos o escopo e ativamos o plano pago com você.
          </p>
        </MarketingContainer>
      </MarketingSection>
      {plans && (
        <MarketingSection muted spacing="md">
          <MarketingContainer width="wide">
            <h2 className="text-center text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2rem]">
              Comparação completa
            </h2>
            <div className="mt-8">
              <PricingComparison plans={plans} />
            </div>
          </MarketingContainer>
        </MarketingSection>
      )}
      <FounderOffer />
      <FAQSection />
    </MarketingPage>
  );
}

function PricingCardsSkeleton() {
  return (
    <div
      className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2"
      aria-busy="true"
      aria-label="Carregando planos"
    >
      {[0, 1].map((key) => (
        <div key={key} className="rounded-xl border border-border bg-surface p-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-3 h-4 w-48" />
          <Skeleton className="mt-6 h-9 w-24" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <Skeleton className="mt-8 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
