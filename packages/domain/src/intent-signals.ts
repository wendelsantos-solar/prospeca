// Intent Signals — discrete, honest "why approach this business NOW" flags.
//
// Distinct from the opportunity score (which ranks *who is an opportunity*):
// intent signals answer *who is ready to hear you today*. They are derived only
// from data we actually observe, never fabricated — same rule as `signals.ts`:
// absent data produces NO signal.
//
// Every signal carries a human label + a grounded reason, so it can be shown as
// a badge and surfaced as a notification without a sales-y promise.

export const INTENT_SIGNALS = [
  "SITE_UNREACHABLE",
  "CRITICAL_REPUTATION",
  "NO_ONLINE_PRESENCE",
] as const;

export type IntentSignal = (typeof INTENT_SIGNALS)[number];

export interface IntentSignalContext {
  hasWebsite: boolean;
  /** Enrichment lifecycle — `failed` means the website scrape did not answer. */
  enrichmentState?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
}

export interface IntentSignalDetail {
  signal: IntentSignal;
  label: string;
  reason: string;
  urgency: "high";
}

const CRITICAL_RATING_MAX = 3.0;

/**
 * Derive the observable intent signals. Returns an empty array when nothing
 * applies — we never invent urgency.
 */
export function deriveIntentSignals(ctx: IntentSignalContext): IntentSignalDetail[] {
  const out: IntentSignalDetail[] = [];

  // Site declarado no Google, mas o enriquecimento (scrape) não respondeu.
  // Motivo honesto: pode ser site fora do ar OU bloqueio de scraper — não
  // afirmamos qual, só que a verificação falhou.
  if (ctx.hasWebsite && ctx.enrichmentState === "failed") {
    out.push({
      signal: "SITE_UNREACHABLE",
      label: "Site inacessível",
      reason: "o site existe mas não respondeu à última verificação",
      urgency: "high",
    });
  }

  if (ctx.rating != null && ctx.rating < CRITICAL_RATING_MAX) {
    const volume =
      ctx.reviewCount != null && ctx.reviewCount > 0 ? ` com ${ctx.reviewCount} avaliações` : "";
    out.push({
      signal: "CRITICAL_REPUTATION",
      label: "Reputação crítica",
      reason: `nota ${ctx.rating.toFixed(1)}${volume} — clientes insatisfeitos`,
      urgency: "high",
    });
  }

  // Zero presença digital mapeada: sem site, sem Instagram, sem WhatsApp.
  if (!ctx.hasWebsite && !ctx.instagram && !ctx.whatsapp) {
    out.push({
      signal: "NO_ONLINE_PRESENCE",
      label: "Invisível online",
      reason: "nenhuma presença digital encontrada (site, Instagram ou WhatsApp)",
      urgency: "high",
    });
  }

  return out;
}
