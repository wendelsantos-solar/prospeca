import { useEffect } from "react";
import { MarketingPage } from "./MarketingLayout";
import { AnimatedSection } from "./AnimatedSection";
import { HeroSection } from "./HeroSection";
import { TrustStrip } from "./TrustStrip";
import { ProblemSection } from "./ProblemSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { OpportunitySection } from "./OpportunitySection";
import { ScoreSection } from "./ScoreSection";
import { MapSection } from "./MapSection";
import { PipelineSection } from "./PipelineSection";
import { MessagingSection } from "./MessagingSection";
import { UseCasesSection } from "./UseCasesSection";
import { AgencySection } from "./AgencySection";
import { BenefitsSection } from "./BenefitsSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { CaseStudySection } from "./CaseStudySection";
import { PricingTeaser } from "./PricingTeaser";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { FinalCTA } from "./FinalCTA";
import { captureUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

export function LandingPage() {
  useEffect(() => {
    captureUtm();
    track("landing_viewed", {});
  }, []);

  return (
    <MarketingPage>
      <HeroSection />
      <TrustStrip />
      <AnimatedSection>
        <ProblemSection />
      </AnimatedSection>
      <AnimatedSection>
        <HowItWorksSection />
      </AnimatedSection>
      <AnimatedSection>
        <OpportunitySection />
      </AnimatedSection>
      <AnimatedSection>
        <ScoreSection />
      </AnimatedSection>
      <AnimatedSection>
        <MapSection />
      </AnimatedSection>
      <AnimatedSection>
        <PipelineSection />
      </AnimatedSection>
      <AnimatedSection>
        <MessagingSection />
      </AnimatedSection>
      <AnimatedSection>
        <UseCasesSection />
      </AnimatedSection>
      <AnimatedSection>
        <AgencySection />
      </AnimatedSection>
      <AnimatedSection>
        <BenefitsSection />
      </AnimatedSection>
      <TestimonialsSection />
      <CaseStudySection />
      <AnimatedSection>
        <PricingTeaser />
      </AnimatedSection>
      <FounderOffer />
      <AnimatedSection>
        <FAQSection />
      </AnimatedSection>
      <FinalCTA />
    </MarketingPage>
  );
}
