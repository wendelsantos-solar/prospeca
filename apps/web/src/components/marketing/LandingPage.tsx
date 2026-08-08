import { useEffect } from "react";
import { MarketingPage } from "./MarketingLayout";
import { AnimatedSection } from "./AnimatedSection";
import { HeroSection } from "./HeroSection";
import { TrustStrip } from "./TrustStrip";
import { HowItWorksSection } from "./HowItWorksSection";
import { OpportunitySection } from "./OpportunitySection";
import { UseCasesSection } from "./UseCasesSection";
import { PilotSection } from "./PilotSection";
import { PricingTeaser } from "./PricingTeaser";
import { FounderOffer } from "./FounderOffer";
import { FAQSection } from "./FAQSection";
import { FinalCTA } from "./FinalCTA";
import { captureUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

/**
 * Landing page — conversion-focused flow:
 * Hero → trust guarantees → product demo → score differentiation →
 * use cases → pilot transparency → pricing → FAQ → CTA
 */
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
        <HowItWorksSection />
      </AnimatedSection>
      <AnimatedSection>
        <OpportunitySection />
      </AnimatedSection>
      <AnimatedSection>
        <UseCasesSection />
      </AnimatedSection>
      <PilotSection />
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
