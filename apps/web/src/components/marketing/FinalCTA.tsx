import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingContainer } from "./MarketingLayout";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

export function FinalCTA() {
  return (
    <section className="border-t border-border bg-surface-2">
      <MarketingContainer width="narrow" className="py-20 md:py-28">
        <div className="text-center">
          <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2.25rem]">
            Sua próxima oportunidade pode estar<br />a poucos quilômetros de você
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Crie sua primeira busca em poucos minutos, encontre empresas que precisam do seu
            serviço e organize sua prospecção num pipeline visual.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 px-6 text-base"
              asChild
              onClick={() => track("hero_cta_clicked", { location: "final_cta" })}
            >
              <Link to="/cadastro">
                Começar gratuitamente
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <SalesContactForm
              source="final_cta"
              trigger={
                <Button size="lg" variant="outline" className="h-11 px-6 text-base">
                  Falar com a equipe
                </Button>
              }
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão de crédito. Configure em poucos minutos.
          </p>
        </div>
      </MarketingContainer>
    </section>
  );
}
