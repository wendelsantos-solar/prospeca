// NBA mapper — Fase 6. The decision tree now lives in the pure domain
// (packages/domain/src/next-best-action.ts#recommendNextBestAction); this file
// is a THIN adapter: maps the web `Lead` onto the domain input and translates
// the domain result into the web `Nba` shape (pt-BR action/cta + the cadence
// step object for progress UI). No business rules here.
import type { DisplayLead, Lead } from "@/types";
import {
  recommendNextBestAction,
  type DecisionMakerHint,
  type NextBestActionInput,
} from "@leads/domain";
import { CADENCE_STEPS, type CadenceStep } from "./cadence";

export type NbaPriority = "high" | "medium" | "low";
export type NbaChannel = "whatsapp" | "call" | "email" | "system";

export interface Nba {
  action: string;
  reason: string;
  channel: NbaChannel;
  priority: NbaPriority;
  daysSinceContact: number | null;
  cta: string;
  /** Set only when a cadence step is due — lets the UI show step progress and
   * pre-fill the draft with the step's opening line. */
  cadenceStep?: CadenceStep;
  /** Decisor que a ação manda procurar, quando identificado. */
  decisionMaker?: DecisionMakerHint | null;
}

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/**
 * Lead → domain input. Pure shape mapping, no decisions.
 *
 * O decisor chega por FORA do Lead: ele vive em `company_people`, ligado ao
 * place, e é carregado sob demanda por quem renderiza (useCompanyPeople). Não
 * é campo de Lead e não deve virar um — a mesma empresa pode estar em várias
 * buscas e o decisor pertence à empresa, não ao lead.
 */
export function leadToNbaInput(
  lead: DisplayLead,
  decisionMaker?: DecisionMakerHint | null,
): NextBestActionInput {
  return {
    hasWebsite: lead.hasWebsite,
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone,
    whatsappStatus: lead.whatsapp ? "verified" : "unknown",
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    temperature: lead.temperature,
    score: lead.score,
    crmStage: lead.stage,
    lastContactDays: daysSince(lead.lastInteractionAt),
    cadenceStartedDays: daysSince(lead.cadenceStartedAt),
    cadenceStep: lead.cadenceStep ?? 0,
    cadenceCompleted: !!lead.cadenceCompletedAt,
    decisionMaker: decisionMaker ?? null,
  };
}

export function computeNba(lead: DisplayLead, decisionMaker?: DecisionMakerHint | null): Nba {
  const input = leadToNbaInput(lead, decisionMaker);
  const rec = recommendNextBestAction(input);
  return {
    action: rec.recommendation,
    reason: rec.reason,
    channel: rec.channel === "phone" ? "call" : rec.channel === "none" ? "system" : rec.channel,
    priority: rec.urgency,
    daysSinceContact: input.lastContactDays ?? null,
    cta: rec.ctaHint ?? "Abrir detalhes",
    cadenceStep: rec.cadenceStepId
      ? CADENCE_STEPS.find((s) => s.id === rec.cadenceStepId)
      : undefined,
    decisionMaker: rec.decisionMaker ?? null,
  };
}
