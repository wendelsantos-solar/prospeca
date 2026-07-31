import { useEffect } from "react";
import { MarketingPage } from "./MarketingLayout";
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
      <ProblemSection />
      <HowItWorksSection />
      <OpportunitySection />
      <ScoreSection />
      <MapSection />
      <PipelineSection />
      <MessagingSection />
      <UseCasesSection />
      <AgencySection />
      <BenefitsSection />
      <TestimonialsSection />
      <CaseStudySection />
      <PricingTeaser />
      <FounderOffer />
      <FAQSection />
      <FinalCTA />
    </MarketingPage>
  );
}
