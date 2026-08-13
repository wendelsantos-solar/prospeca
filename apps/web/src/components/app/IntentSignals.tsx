import { TrendingUp } from "lucide-react";
import { deriveIntentSignals } from "@leads/domain";
import type { Lead } from "@/types";

/**
 * "Sinais de intenção" — discrete, honest flags that answer "why approach this
 * business NOW" (distinct from the opportunity score, which ranks *who* is an
 * opportunity). Derived only from observed data via the shared domain rule.
 */
export function IntentSignals({ lead }: { lead: Lead }) {
  const signals = deriveIntentSignals({
    hasWebsite: lead.hasWebsite,
    enrichmentState: lead.enrichmentState,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    instagram: lead.instagram,
    whatsapp: lead.whatsapp,
  });

  if (signals.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-warning/40 bg-warning-soft p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-warning-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        Sinais de intenção — por que abordar agora
      </div>
      <ul className="space-y-1.5">
        {signals.map((s) => (
          <li key={s.signal} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
            <span className="text-foreground">
              <span className="font-semibold">{s.label}.</span>{" "}
              <span className="text-muted-foreground">
                {lead.companyName} {s.reason}.
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
