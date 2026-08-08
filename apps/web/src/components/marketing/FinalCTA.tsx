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
            Encontre sua próxima oportunidade
            <br />
            antes da próxima hora de pesquisa manual
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Crie sua primeira busca, entenda quais empresas merecem atenção e organize o próximo
            contato sem planilhas espalhadas.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 px-6 text-base"
              asChild
              onClick={() => track("hero_cta_clicked", { location: "final_cta" })}
            >
              <Link to="/cadastro">
                Criar conta grátis
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
            Sem cartão de crédito. Plano grátis disponível.
          </p>
        </div>
      </MarketingContainer>
    </section>
  );
}
