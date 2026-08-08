import { Star } from "lucide-react";
import { SOCIAL_PROOF } from "@/marketing/social-proof-data";

/**
 * Simple social proof — just ratings, no extra text.
 * Placed above the headline for instant credibility.
 */
export function SocialProofBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 text-[13px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.google.rating}</span>
        Google
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.trustpilot.rating}</span>
        Trustpilot
      </span>
    </div>
  );
}
