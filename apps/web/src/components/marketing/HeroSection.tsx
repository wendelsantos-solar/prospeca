import { Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "./Section";
import { ProductPreview } from "./ProductPreview";
import { track } from "@/lib/analytics";

export function HeroSection() {
  return (
    <section id="produto" className="pt-16 md:pt-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Inteligência comercial local</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Encontre empresas que precisam exatamente do serviço que você vende.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Pesquise empresas por nicho e região, identifique oportunidades com baixa presença
            digital e organize toda a sua prospecção em um só lugar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              onClick={() => track("hero_cta_clicked", { location: "hero_primary" })}
            >
              <Link to="/cadastro">
                Começar gratuitamente
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              onClick={() => track("demo_clicked", { location: "hero" })}
            >
              <a href="#como-funciona">
                <PlayCircle className="h-4 w-4" />
                Ver como funciona
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem cartão de crédito. Configure sua primeira busca em poucos minutos.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
