import type { Lead } from "@/types";

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

// D+2/D+4/D+7/D+14, alternating WhatsApp/call — the cadence found to be
// standard practice for BR B2B follow-up (see docs/FEATURE_ROADMAP_2026-08.md).
export const CADENCE_STEPS: CadenceStep[] = [
  {
    id: "followup-1",
    order: 1,
    dueAtDay: 2,
    channel: "whatsapp",
    label: "Follow-up curto",
    messageOpener: "Passando rapidinho para saber se você chegou a ver minha mensagem.",
  },
  {
    id: "call-1",
    order: 2,
    dueAtDay: 4,
    channel: "call",
    label: "Ligação de clareza",
    messageOpener: "",
  },
  {
    id: "followup-2",
    order: 3,
    dueAtDay: 7,
    channel: "whatsapp",
    label: "Novo argumento",
    messageOpener:
      "Sei que a rotina é corrida — trouxe um outro ângulo que pode fazer sentido pra vocês.",
  },
  {
    id: "last-attempt",
    order: 4,
    dueAtDay: 14,
    channel: "whatsapp",
    label: "Última tentativa",
    messageOpener:
      "Essa é minha última tentativa de contato por aqui — se não for o momento certo, sem problemas.",
  },
];

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
