import type { Lead } from "@/types";
import { CADENCE_STEP_DEFS } from "@leads/domain";

export interface CadenceStep {
  id: string;
  order: number;
  /** Days since the lead's last interaction at which this step becomes due. */
  dueAtDay: number;
  channel: "whatsapp" | "call";
  label: string;
  /** Opening line prepended to the drafted message for this touch — escalates
   * across steps instead of resending the same generic template every time. */
  messageOpener: string;
}

// Step definition comes from the DOMAIN (single source of truth —
// CADENCE_STEP_DEFS in @leads/domain next-best-action.ts); the web layer only
// adds the message openers (UI copy).
const OPENERS: Record<string, string> = {
  "followup-1": "Passando rapidinho para saber se você chegou a ver minha mensagem.",
  "call-1": "",
  "followup-2":
    "Sei que a rotina é corrida — trouxe um outro ângulo que pode fazer sentido pra vocês.",
  "last-attempt":
    "Essa é minha última tentativa de contato por aqui — se não for o momento certo, sem problemas.",
};

// D+2/D+4/D+7/D+14, alternating WhatsApp/call — the cadence found to be
// standard practice for BR B2B follow-up (see docs/FEATURE_ROADMAP_2026-08.md).
export const CADENCE_STEPS: CadenceStep[] = CADENCE_STEP_DEFS.map((def) => ({
  ...def,
  messageOpener: OPENERS[def.id] ?? "",
}));

type CadenceLead = Pick<Lead, "stage" | "cadenceStartedAt" | "cadenceStep" | "cadenceCompletedAt">;

function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
}

/**
 * The cadence step currently due for a contacted lead — the latest step
 * whose day threshold has passed. Null when too soon, no anchor date, or
 * the lead isn't in `contacted`.
 */
export function currentCadenceStep(lead: CadenceLead, now = new Date()): CadenceStep | null {
  if (lead.stage !== "contacted" || lead.cadenceCompletedAt) return null;
  const days = daysSince(lead.cadenceStartedAt, now);
  if (days === null) return null;
  const pending = CADENCE_STEPS.find((step) => step.order > (lead.cadenceStep ?? 0));
  return pending && days >= pending.dueAtDay ? pending : null;
}

/** The step still ahead (not yet due) — for showing "coming up" in the UI. */
export function nextCadenceStep(lead: CadenceLead, now = new Date()): CadenceStep | null {
  if (lead.stage !== "contacted" || lead.cadenceCompletedAt) return null;
  const days = daysSince(lead.cadenceStartedAt, now);
  if (days === null) return null;
  const pending = CADENCE_STEPS.find((step) => step.order > (lead.cadenceStep ?? 0));
  return pending && days < pending.dueAtDay ? pending : null;
}

/** ISO due date for `step`, anchored on the confirmed first contact. */
export function cadenceStepDueDate(
  lead: Pick<Lead, "cadenceStartedAt">,
  step: CadenceStep,
): string | null {
  if (!lead.cadenceStartedAt) return null;
  const d = new Date(lead.cadenceStartedAt);
  d.setDate(d.getDate() + step.dueAtDay);
  return d.toISOString();
}
