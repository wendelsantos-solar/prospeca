import { Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, MarketingContainer } from "./MarketingLayout";
import { SocialProofBadges } from "./SocialProofBadges";
import { FloatingIcons } from "./FloatingIcons";
import { HeroActivityFeed } from "./HeroActivityFeed";
import { track } from "@/lib/analytics";

export function HeroSection() {
  return (
    <section id="produto" className="relative overflow-clip pt-28 md:pt-36 lg:pt-40">
      {/* ── Background glow layers (CSS-only depth) ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary green glow */}
        <div
          className="absolute left-1/2 top-[35%] h-[520px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,163,74,0.13) 0%, rgba(22,163,74,0.05) 38%, transparent 72%)",
            filter: "blur(85px)",
          }}
        />
        {/* Warm accent glow (corners) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 3% 4%, rgba(245,158,11,0.08), transparent 32%), radial-gradient(circle at 97% 4%, rgba(245,158,11,0.07), transparent 32%)",
            filter: "blur(60px)",
          }}
        />
        {/* Central halo — keeps text legible */}
        <div
          className="absolute left-1/2 top-[38%] h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.35) 45%, transparent 75%)",
          }}
        />
      </div>

      <MarketingContainer width="default">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <SocialProofBadges />
          <Eyebrow>Inteligência comercial local</Eyebrow>
          <h1 className="text-[2.25rem] leading-[1.06] font-semibold tracking-tight text-foreground md:text-[3rem] lg:text-[3.5rem]">
            Encontre empresas que precisam<br />exatamente do que você vende
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Pesquise entre{" "}
            <strong className="font-semibold text-foreground">28M+ CNPJs</strong> por nicho e
            região, veja o score que explica quem priorizar e organize toda a prospecção — da
            descoberta ao fechamento — num lugar só.
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

          {/* Live activity feed — shows the product working */}
          <HeroActivityFeed />
        </div>
      </MarketingContainer>

      {/* Integration orbit — floats around the entire hero, like Kaptto's .ob badges */}
      <FloatingIcons />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
