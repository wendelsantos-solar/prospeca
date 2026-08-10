import { BadgeCheck, CreditCard, MousePointerClick } from "lucide-react";

/**
 * Concrete product guarantees — no unverifiable ratings or vanity metrics.
 */
export function SocialProofBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-muted-foreground sm:text-[13px] lg:justify-start">
      <span className="inline-flex items-center gap-1.5">
        <CreditCard className="h-3.5 w-3.5 text-primary" />
        Plano grátis sem cartão
      </span>
      <span className="inline-flex items-center gap-1.5">
        <BadgeCheck className="h-3.5 w-3.5 text-primary" />
        Score explicado, sem caixa-preta
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MousePointerClick className="h-3.5 w-3.5 text-primary" />
        Você controla cada envio
      </span>
    </div>
  );
}
