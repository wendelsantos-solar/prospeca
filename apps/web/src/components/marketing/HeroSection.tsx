import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingContainer } from "./MarketingLayout";
import { SocialProofBadges } from "./SocialProofBadges";
import { HeroActivityFeed } from "./HeroActivityFeed";
import { track } from "@/lib/analytics";

export function HeroSection() {
  return (
    <section
      id="produto"
      className="relative flex min-h-screen items-center overflow-clip bg-white pb-16 pt-28 md:pb-20 md:pt-32 lg:py-24"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute right-[-12%] top-[20%] h-[720px] w-[720px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,163,74,0.09) 0%, rgba(22,163,74,0.03) 38%, transparent 68%)",
            filter: "blur(90px)",
          }}
        />
        <div
          className="absolute left-[8%] top-0 h-[360px] w-[680px] rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04), transparent 60%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      <MarketingContainer width="default">
        <div className="relative z-10 grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12 xl:gap-20">
          <div className="text-center lg:text-left">
            <SocialProofBadges />

            <h1 className="mx-auto mt-6 max-w-[680px] text-[2.65rem] font-bold leading-[1.01] tracking-[-0.04em] text-foreground md:text-[3.35rem] lg:mx-0 lg:text-[3.8rem] xl:text-[4.2rem]">
              Encontre negócios locais com <span className="text-primary">alto potencial</span>
            </h1>

            <p className="mx-auto mt-6 max-w-[560px] text-[16px] leading-relaxed text-muted-foreground md:text-[17px] lg:mx-0">
              Pesquise por nicho e região, identifique sinais comerciais reais e saiba quais
              empresas merecem sua atenção primeiro.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button
                size="lg"
                className="h-12 px-7 text-[15px]"
                asChild
                onClick={() => track("hero_cta_clicked", { location: "hero_primary" })}
              >
                <Link to="/cadastro">
                  Criar conta grátis
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-7 text-[15px] border-border/80"
                asChild
              >
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Sem cartão de crédito. Configure sua primeira busca em poucos minutos.
            </p>
          </div>

          <HeroActivityFeed />
        </div>
      </MarketingContainer>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
