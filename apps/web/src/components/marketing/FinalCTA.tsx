import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export function FinalCTA() {
  return (
    <section className="border-t border-border bg-surface-2 py-16 md:py-24">
      <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Sua próxima oportunidade pode estar a poucos quilômetros de você.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Crie sua primeira busca, encontre empresas relevantes e organize sua prospecção em poucos
          minutos.
        </p>
        <Button
          size="lg"
          className="mt-6"
          asChild
          onClick={() => track("hero_cta_clicked", { location: "final_cta" })}
        >
          <Link to="/cadastro">
            Começar gratuitamente
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">Sem cartão de crédito.</p>
      </div>
    </section>
  );
}
