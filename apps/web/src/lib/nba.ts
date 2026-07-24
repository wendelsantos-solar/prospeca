import type { Lead } from "@/types";

export type NbaPriority = "high" | "medium" | "low";
export type NbaChannel = "whatsapp" | "call" | "email" | "system";

export interface Nba {
  action: string;
  reason: string;
  channel: NbaChannel;
  priority: NbaPriority;
  daysSinceContact: number | null;
  cta: string;
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
    if (days === null || days < 2) {
      return {
        action: "Aguardar resposta",
        reason: "Contato recente. Aguarde a resposta antes de insistir.",
        channel: "system",
        priority: "low",
        daysSinceContact: days,
        cta: "Agendar retorno",
      };
    }
    if (days <= 5) {
      return {
        action: "Fazer follow-up pelo WhatsApp",
        reason: `Sem retorno há ${days} dias. Um follow-up curto e cordial pode destravar.`,
        channel: lead.whatsapp ? "whatsapp" : "call",
        priority: "high",
        daysSinceContact: days,
        cta: "Preparar follow-up",
      };
    }
    if (days <= 10) {
      return {
        action: "Tentar ligação",
        reason: `${days} dias sem resposta por mensagem. Uma ligação aumenta a chance de conexão.`,
        channel: "call",
        priority: "high",
        daysSinceContact: days,
        cta: "Ligar agora",
      };
    }
    return {
      action: "Última tentativa ou descartar",
      reason: `${days} dias sem resposta. Envie uma última mensagem ou mova para descartado.`,
      channel: lead.whatsapp ? "whatsapp" : "call",
      priority: "medium",
      daysSinceContact: days,
      cta: "Última tentativa",
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
