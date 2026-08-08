import { useEffect } from "react";
import { MarketingPage } from "./MarketingLayout";
import { AnimatedSection } from "./AnimatedSection";
import { HeroSection } from "./HeroSection";
import { TrustStrip } from "./TrustStrip";
import { HowItWorksSection } from "./HowItWorksSection";
import { OpportunitySection } from "./OpportunitySection";
import { MapSection } from "./MapSection";
import { PipelineSection } from "./PipelineSection";
import { MessagingSection } from "./MessagingSection";
import { BenefitsSection } from "./BenefitsSection";
import { UseCasesSection } from "./UseCasesSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { PricingTeaser } from "./PricingTeaser";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { FinalCTA } from "./FinalCTA";
import { SoftwareApplicationSchema, FAQSchema } from "./StructuredData";
import { captureUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

/**
 * Landing page — redesigned flow:
 * Hero → Como funciona → Encontre + Priorize → Mapa → Pipeline →
 * Mensagens → Benefícios → Para quem → Social proof → Preços → FAQ → CTA
 */
export function LandingPage() {
  useEffect(() => {
    captureUtm();
    track("landing_viewed", {});
  }, []);

  return (
    <MarketingPage>
      <SoftwareApplicationSchema />
      <FAQSchema />

      {/* 1. Hero — full viewport */}
      <HeroSection />

      {/* 2. Como funciona — 5 steps overview */}
      <TrustStrip />

      {/* 3. Como funciona — interactive tabs */}
      <AnimatedSection>
        <HowItWorksSection />
      </AnimatedSection>

      {/* 4. Encontre + Priorize — lead discovery */}
      <AnimatedSection>
        <OpportunitySection />
      </AnimatedSection>

      {/* 5. Mapa — visual discovery */}
      <AnimatedSection>
        <MapSection />
      </AnimatedSection>

      {/* 6. Pipeline — organize */}
      <AnimatedSection>
        <PipelineSection />
      </AnimatedSection>

      {/* 7. Mensagens — approach */}
      <AnimatedSection>
        <MessagingSection />
      </AnimatedSection>

      {/* 8. Benefícios — why Prospeca */}
      <AnimatedSection>
        <BenefitsSection />
      </AnimatedSection>

      {/* 9. Para quem é */}
      <AnimatedSection>
        <UseCasesSection />
      </AnimatedSection>

      {/* 10. Social proof */}
      <TestimonialsSection />

      {/* 11. Pricing */}
      <AnimatedSection>
        <PricingTeaser />
      </AnimatedSection>
      <FounderOffer />

      {/* 12. FAQ */}
      <AnimatedSection>
        <FAQSection />
      </AnimatedSection>

      {/* 13. Final CTA */}
      <FinalCTA />
    </MarketingPage>
  );
}
