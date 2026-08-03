import type { Lead } from "@/types";
import {
  CADENCE_STEPS,
  currentCadenceStep,
  nextCadenceStep,
  cadenceStepDueDate,
  type CadenceStep,
} from "./cadence";

export type NbaPriority = "high" | "medium" | "low";
export type NbaChannel = "whatsapp" | "call" | "email" | "system";

export interface Nba {
  action: string;
  reason: string;
  channel: NbaChannel;
  priority: NbaPriority;
  daysSinceContact: number | null;
  cta: string;
  /** Set only in the "contacted" cadence branch — lets the UI show step
   * progress and pre-fill the draft with the step's opening line. */
  cadenceStep?: CadenceStep;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function computeNba(lead: Lead): Nba {
  const days = daysSince(lead.lastInteractionAt);
  const noChannels = !lead.whatsapp && !lead.phone && !lead.email;

  if (lead.stage === "won") {
    return {
      action: "Registrar próximos passos",
      reason: "Negócio ganho. Documente entregas e agende o kickoff.",
      channel: "system",
      priority: "low",
      daysSinceContact: days,
      cta: "Criar atividade",
    };
  }
  if (lead.stage === "discarded") {
    return {
      action: "Revisar motivo do descarte",
      reason: "Lead descartado. Confirme se há espaço para reativação futura.",
      channel: "system",
      priority: "low",
      daysSinceContact: days,
      cta: "Abrir detalhes",
    };
  }

  if (noChannels) {
    return {
      action: "Buscar outro canal",
      reason: "Nenhum canal de contato encontrado. Enriqueça o cadastro antes de abordar.",
      channel: "system",
      priority: "medium",
      daysSinceContact: days,
      cta: "Editar dados",
    };
  }

  if (lead.stage === "new") {
    if (days === null) {
      return {
        action: "Enviar primeira abordagem",
        reason: lead.whatsapp
          ? "Lead novo com WhatsApp disponível. Faça o primeiro contato agora."
          : "Lead novo. Faça a primeira abordagem pelo canal disponível.",
        channel: lead.whatsapp ? "whatsapp" : lead.phone ? "call" : "email",
        priority: "high",
        daysSinceContact: null,
        cta: "Preparar abordagem",
      };
    }
    if (days < 2) {
      return {
        action: "Aguardar retorno",
        reason: `Abordado há ${days} dia${days === 1 ? "" : "s"}. Dê tempo antes do próximo toque.`,
        channel: "system",
        priority: "low",
        daysSinceContact: days,
        cta: "Agendar follow-up",
      };
    }
  }

  if (lead.stage === "contacted") {
    if ((lead.cadenceStep ?? 0) >= CADENCE_STEPS.length || lead.cadenceCompletedAt) {
      return {
        action: "Definir próximo passo",
        reason:
          "A cadência foi concluída. Registre a resposta ou decida se a oportunidade continua.",
        channel: "system",
        priority: "medium",
        daysSinceContact: days,
        cta: "Abrir detalhes",
      };
    }

    const step = currentCadenceStep(lead);
    if (!step) {
      const next = nextCadenceStep(lead);
      const nextDueAt = next ? cadenceStepDueDate(lead, next) : null;
      return {
        action: lead.cadenceStartedAt ? "Aguardar resposta" : "Confirmar primeiro contato",
        reason: nextDueAt
          ? `Próximo toque em ${new Date(nextDueAt).toLocaleDateString("pt-BR")}.`
          : "A cadência só começa depois que o primeiro contato é confirmado.",
        channel: "system",
        priority: "low",
        daysSinceContact: days,
        cta: lead.cadenceStartedAt ? "Agendar retorno" : "Abrir detalhes",
      };
    }
    const isLast = step.order === CADENCE_STEPS.length;
    return {
      action: step.label,
      reason: `${days} dias sem resposta — toque ${step.order} de ${CADENCE_STEPS.length} da cadência (${step.label.toLowerCase()}).`,
      channel: step.channel === "call" ? "call" : lead.whatsapp ? "whatsapp" : "call",
      priority: isLast ? "medium" : "high",
      daysSinceContact: days,
      cta: step.channel === "call" ? "Ligar agora" : "Preparar follow-up",
      cadenceStep: step,
    };
  }

  if (lead.stage === "qualified") {
    return {
      action: "Agendar reunião ou enviar proposta",
      reason: "Lead qualificado. Avance para o próximo passo comercial concreto.",
      channel: lead.whatsapp ? "whatsapp" : "call",
      priority: "high",
      daysSinceContact: days,
      cta: "Agendar reunião",
    };
  }

  return {
    action: "Revisar próximo passo",
    reason: "Defina uma próxima ação para não perder o lead de vista.",
    channel: "system",
    priority: "medium",
    daysSinceContact: days,
    cta: "Criar atividade",
  };
}
