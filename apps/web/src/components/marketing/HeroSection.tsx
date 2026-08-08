import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingContainer } from "./MarketingLayout";
import { SocialProofBadges } from "./SocialProofBadges";
import { FloatingIcons } from "./FloatingIcons";
import { HeroActivityFeed } from "./HeroActivityFeed";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

export function HeroSection() {
  return (
    <section
      id="produto"
      className="relative flex flex-col items-center justify-center overflow-clip bg-white"
      style={{ minHeight: "calc(100vh - 40px)" }}
    >
      {/* ── Background: subtle radial glow only ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary green — very subtle */}
        <div
          className="absolute left-1/2 top-[46%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(22,163,74,0.07) 0%, rgba(22,163,74,0.02) 35%, transparent 65%)",
            filter: "blur(90px)",
          }}
        />
        {/* Top warm accent — barely there */}
        <div
          className="absolute left-1/2 top-0 h-[400px] w-[900px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.04), transparent 60%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* ── Orbital system ── */}
      <FloatingIcons />

      {/* ── Content ── */}
      <MarketingContainer width="default">
        <div className="relative z-10 mx-auto max-w-[780px] text-center">
          {/* Social proof — simple, above headline */}
          <SocialProofBadges />

          {/* Headline */}
          <h1
            className="mx-auto mt-5 max-w-[700px] text-[2.5rem] font-bold leading-[1.02] tracking-[-0.035em] text-foreground md:text-[3.2rem] lg:text-[3.8rem]"
          >
            Encontre empresas que precisam
            <br />
            exatamente do que você vende
          </h1>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-[520px] text-[16px] leading-relaxed text-muted-foreground md:text-[17px]">
            Pesquise empresas por nicho e região, priorize as melhores
            oportunidades e organize sua prospecção em um só lugar.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 px-7 text-[15px]"
              asChild
              onClick={() => track("hero_cta_clicked", { location: "hero_primary" })}
            >
              <Link to="/cadastro">
                Começar gratuitamente
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <SalesContactForm
              source="hero"
              trigger={
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-[15px] border-border/80"
                >
                  Falar com vendas
                </Button>
              }
            />
          </div>

          {/* Activity card — dynamic social proof */}
          <HeroActivityFeed />
        </div>
      </MarketingContainer>

      {/* ── Bottom fade to next section ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
