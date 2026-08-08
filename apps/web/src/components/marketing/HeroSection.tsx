import { Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, MarketingContainer } from "./MarketingLayout";
import { HeroProductDemo } from "./HeroProductDemo";
import { SocialProofBadges } from "./SocialProofBadges";
import { FloatingIcons } from "./FloatingIcons";
import { track } from "@/lib/analytics";

export function HeroSection() {
  return (
    <section id="produto" className="relative overflow-hidden pt-24 md:pt-32 lg:pt-36">
      <MarketingContainer width="default">
        <div className="mx-auto max-w-3xl text-center">
          <SocialProofBadges />
          <Eyebrow>Inteligência comercial local</Eyebrow>
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-tight text-foreground md:text-[3rem] lg:text-[3.5rem]">
            Pare de adivinhar quem prospectar. Veja o score antes de ligar.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-section-title">
            Pesquise por nicho e região, veja o score que explica quem priorizar primeiro e organize
            toda a prospecção — da descoberta ao fechamento — em um só lugar.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 px-6 text-base"
              asChild
              onClick={() => track("hero_cta_clicked", { location: "hero_primary" })}
            >
              <Link to="/cadastro">
                Começar gratuitamente
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 text-base"
              asChild
              onClick={() => track("demo_clicked", { location: "hero" })}
            >
              <a href="#como-funciona">
                <PlayCircle className="h-4 w-4" />
                Ver como funciona
              </a>
            </Button>
          </div>
          <p className="mt-4 text-caption text-muted-foreground">
            Sem cartão de crédito. Configure sua primeira busca em poucos minutos.
          </p>
        </div>
      </MarketingContainer>

      <MarketingContainer width="showcase" className="relative mt-14 md:mt-16">
        <FloatingIcons />
        <HeroProductDemo />
      </MarketingContainer>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
