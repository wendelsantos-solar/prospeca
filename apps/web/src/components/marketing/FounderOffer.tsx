import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchFounderOffer, formatPriceCents } from "@/lib/billing-plans";
import { Section, SectionHeading } from "./Section";
import { Button } from "@/components/ui/button";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

/**
 * Seat count and pricing come from `founder_offer` in the database — never
 * hardcoded here, never a fabricated "vagas restantes" countdown. Renders
 * nothing until someone flips `is_active` on with real numbers.
 */
export function FounderOffer() {
  const { data } = useQuery({ queryKey: ["founder-offer"], queryFn: fetchFounderOffer });

  useEffect(() => {
    if (data?.isActive) track("founder_offer_viewed", {});
  }, [data?.isActive]);

  if (!data || !data.isActive) return null;

  const remaining =
    data.seatsTotal !== null ? Math.max(0, data.seatsTotal - data.seatsClaimed) : null;
  const soldOut = remaining === 0;

  return (
    <Section id="fundadores" muted>
      <SectionHeading
        eyebrow="Oferta por tempo limitado"
        title="Faça parte dos primeiros clientes do Radar Local."
        center
      />
      <div className="mx-auto mt-8 max-w-md rounded-xl border border-primary/30 bg-surface p-6 text-center">
        <div className="text-3xl font-bold text-foreground">
          {formatPriceCents(data.priceCents)}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          por mês, benefício mantido no período da oferta
        </p>
        {remaining !== null && (
          <p className="mt-3 text-sm font-medium text-primary">
            {soldOut ? "Vagas esgotadas" : `${remaining} vaga(s) restante(s)`}
          </p>
        )}
        <ul className="mt-4 space-y-1.5 text-left text-sm text-muted-foreground">
          <li>— Acesso prioritário a novos recursos</li>
          <li>— Participação direta no roadmap</li>
          <li>— Canal de feedback direto com o time</li>
        </ul>
        <SalesContactForm
          source="founder_offer"
          trigger={
            <Button className="mt-5 w-full" disabled={soldOut}>
              {soldOut ? "Vagas esgotadas" : "Quero participar"}
            </Button>
          }
        />
      </div>
    </Section>
  );
}
