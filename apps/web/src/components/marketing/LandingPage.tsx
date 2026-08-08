import { useEffect } from "react";
import { MarketingPage } from "./MarketingLayout";
import { AnimatedSection } from "./AnimatedSection";
import { HeroSection } from "./HeroSection";
import { TrustStrip } from "./TrustStrip";
import { ProblemSection } from "./ProblemSection";
import { WorkspaceSection } from "./WorkspaceSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { BenefitsSection } from "./BenefitsSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { CaseStudySection } from "./CaseStudySection";
import { PricingTeaser } from "./PricingTeaser";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { FinalCTA } from "./FinalCTA";
import { SoftwareApplicationSchema, FAQSchema } from "./StructuredData";
import { captureUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

/**
 * Landing page — 11 sections following Kaptto's proven structure:
 * Hero → Trust → Problem → Workspace → How it works → Benefits →
 * Social proof → Pricing → FAQ → Final CTA
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

      {/* 1. Hero — value prop + social proof + activity feed */}
      <HeroSection />

      {/* 2. Trust — 5 steps + metrics */}
      <TrustStrip />

      {/* 3. Problem — pain point + before/after */}
      <AnimatedSection>
        <ProblemSection />
      </AnimatedSection>

      {/* 4. Workspace — full product showcase (Discovery + Pipeline panels) */}
      <AnimatedSection>
        <WorkspaceSection />
      </AnimatedSection>

      {/* 5. How it works — interactive tabs */}
      <AnimatedSection>
        <HowItWorksSection />
      </AnimatedSection>

      {/* 6. Benefits — why Prospeca */}
      <AnimatedSection>
        <BenefitsSection />
      </AnimatedSection>

      {/* 7. Social proof */}
      <TestimonialsSection />
      <CaseStudySection />

      {/* 8. Pricing */}
      <AnimatedSection>
        <PricingTeaser />
      </AnimatedSection>
      <FounderOffer />

      {/* 9. FAQ */}
      <AnimatedSection>
        <FAQSection />
      </AnimatedSection>

      {/* 10. Final CTA */}
      <FinalCTA />
    </MarketingPage>
  );
}
