import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingContainer } from "./MarketingLayout";
import { track } from "@/lib/analytics";

export function FinalCTA() {
  return (
    <section className="border-t border-border bg-surface-2">
      <MarketingContainer width="narrow" className="py-20 md:py-28">
        <div className="text-center">
          <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground md:text-[2.25rem]">
            Sua próxima oportunidade pode estar a poucos quilômetros de você.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground md:text-lg">
            Crie sua primeira busca, encontre empresas relevantes e organize sua prospecção em
            poucos minutos.
          </p>
          <Button
            size="lg"
            className="mt-8 h-11 px-6 text-base"
            asChild
            onClick={() => track("hero_cta_clicked", { location: "final_cta" })}
          >
            <Link to="/cadastro">
              Começar gratuitamente
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito.</p>
        </div>
      </MarketingContainer>
    </section>
  );
}
