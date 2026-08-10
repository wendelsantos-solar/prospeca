import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesContactForm } from "./SalesContactForm";
import { MarketingContainer } from "./MarketingLayout";
import { track } from "@/lib/analytics";

const BENEFITS = [
  "Onboarding assistido",
  "Contato direto com o time",
  "Sem contratação automática",
];

export function PilotSection() {
  return (
    <section className="border-y border-border bg-surface-2 py-16 md:py-20">
      <MarketingContainer width="narrow">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Piloto aberto
          </p>
          <h2 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2.25rem]">
            Um produto em evolução,
            <br className="hidden sm:block" /> construído com quem prospecta de verdade
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            O plano grátis já está disponível. No Profissional, acompanhamos sua ativação de perto e
            usamos seu feedback para priorizar o que gera resultado no dia a dia.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {BENEFITS.map((benefit) => (
              <span
                key={benefit}
                className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"
              >
                <Check className="h-3.5 w-3.5 text-primary" />
                {benefit}
              </span>
            ))}
          </div>
          <SalesContactForm
            source="pilot_section"
            trigger={
              <Button
                variant="outline"
                className="mt-7"
                onClick={() => track("founder_offer_viewed", { source: "pilot_section" })}
              >
                Quero conhecer o piloto
              </Button>
            }
          />
        </div>
      </MarketingContainer>
    </section>
  );
}
