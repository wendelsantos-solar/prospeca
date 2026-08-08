import { Star } from "lucide-react";
import { SOCIAL_PROOF } from "@/marketing/social-proof-data";

export function SocialProofBadges() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-caption text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.google.rating}</span>
        Google
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.trustpilot.rating}</span>
        Trustpilot · {SOCIAL_PROOF.trustpilot.reviewCount} avaliações
      </span>
    </div>
  );
}
