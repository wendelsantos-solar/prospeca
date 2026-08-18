// Next Best Action — deterministic recommendation of the next commercial step
// (spec #56). Pure logic; the AI enriches the actual message copy (spec #57 —
// generate → review → user decides to send, never auto-send).
//
// Fase 6: this module now owns the FULL decision tree — the funnel branches
// that used to live in apps/web/src/lib/nba.ts (computeNba) were migrated here
// (stages won/discarded, no-contact-channel, cadence due/upcoming/over,
// urgency, CTA hints). The web `lib/nba.ts` is now a thin mapper (Lead →
// NextBestActionInput + pt-BR text). Callers that only pass channels/signals
// (CompanyIntelligenceCard) keep the legacy behavior unchanged.

export interface NextBestActionInput {
  hasWebsite: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  rating: number | null;
  reviewCount: number | null;
  temperature: "hot" | "warm" | "cold";
  score: number;
  /** Funnel stage. Omit for discovery-context callers (legacy behavior). */
  crmStage?: "none" | "new" | "qualified" | "contacted" | "won" | "discarded";
  /** Days since the last interaction (null = never contacted). */
  lastContactDays?: number | null;
  /** Days since the cadence started (contacted leads only). */
  cadenceStartedDays?: number | null;
  /** Cadence steps already completed (0..CADENCE_STEP_DEFS.length). */
  cadenceStep?: number | null;
  /** Whether the cadence was explicitly completed. */
  cadenceCompleted?: boolean;
}

export interface NextBestAction {
  channel: "whatsapp" | "email" | "phone" | "call" | "system" | "none";
  recommendation: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  /** Structured signals that should inform the generated message. */
  messageSignals: string[];
  /** Id of the cadence step currently due (CADENCE_STEP_DEFS). */
  cadenceStepId?: string;
  /** pt-BR label for the action button. */
  ctaHint?: string;
}

// ── Cadence definition (single source of truth — the web cadence.ts maps
//    these onto its UI type and adds message openers) ────────────────────────

export interface CadenceStepDef {
  id: string;
  order: number;
  /** Days since the confirmed first contact at which this step becomes due. */
  dueAtDay: number;
  channel: "whatsapp" | "call";
  label: string;
}

// D+2/D+4/D+7/D+14, alternating WhatsApp/call — the cadence found to be
// standard practice for BR B2B follow-up (docs/FEATURE_ROADMAP_2026-08.md).
export const CADENCE_STEP_DEFS: CadenceStepDef[] = [
  { id: "followup-1", order: 1, dueAtDay: 2, channel: "whatsapp", label: "Follow-up curto" },
  { id: "call-1", order: 2, dueAtDay: 4, channel: "call", label: "Ligação de clareza" },
  { id: "followup-2", order: 3, dueAtDay: 7, channel: "whatsapp", label: "Novo argumento" },
  { id: "last-attempt", order: 4, dueAtDay: 14, channel: "whatsapp", label: "Última tentativa" },
];

/** Channel preference for a lead that HAS channels (fastest reliable first). */
function channelFor(input: NextBestActionInput): "whatsapp" | "email" | "phone" {
  if (input.whatsappStatus === "verified" || input.whatsappStatus === "possible") {
    return "whatsapp";
  }
  if (input.hasEmail) return "email";
  return "phone";
}

function hasAnyChannel(input: NextBestActionInput): boolean {
  return (
    input.whatsappStatus === "verified" ||
    input.whatsappStatus === "possible" ||
    input.hasEmail ||
    input.hasPhone
  );
}

/**
 * The cadence step currently due: the first pending step whose day threshold
 * has passed. Null when too soon, no cadence anchor, or cadence over.
 */
function dueCadenceStep(input: NextBestActionInput): CadenceStepDef | null {
  if (input.crmStage !== "contacted" || input.cadenceCompleted) return null;
  const days = input.cadenceStartedDays;
  if (days == null) return null;
  const pending = CADENCE_STEP_DEFS.find((step) => step.order > (input.cadenceStep ?? 0));
  return pending && days >= pending.dueAtDay ? pending : null;
}

/** The step still ahead (not yet due) — for "coming up" messaging. */
function upcomingCadenceStep(input: NextBestActionInput): CadenceStepDef | null {
  if (input.crmStage !== "contacted" || input.cadenceCompleted) return null;
  const days = input.cadenceStartedDays;
  if (days == null) return null;
  const pending = CADENCE_STEP_DEFS.find((step) => step.order > (input.cadenceStep ?? 0));
  return pending && days < pending.dueAtDay ? pending : null;
}

export function recommendNextBestAction(input: NextBestActionInput): NextBestAction {
  // ── Funnel-terminal stages (migrated from web computeNba) ────────────────
  if (input.crmStage === "won") {
    return {
      channel: "system",
      recommendation: "Registrar próximos passos",
      reason: "Negócio ganho. Documente entregas e agende o kickoff.",
      urgency: "low",
      messageSignals: [],
      ctaHint: "Criar atividade",
    };
  }
  if (input.crmStage === "discarded") {
    return {
      channel: "system",
      recommendation: "Revisar motivo do descarte",
      reason: "Lead descartado. Confirme se há espaço para reativação futura.",
      urgency: "low",
      messageSignals: [],
      ctaHint: "Abrir detalhes",
    };
  }

  // ── No contact channel at all (funnel only — the legacy/discovery path
  //    below keeps its own 'none' behavior) ────────────────────────────────
  const inFunnel = input.crmStage != null && input.crmStage !== "none";
  if (inFunnel && !hasAnyChannel(input)) {
    return {
      channel: "system",
      recommendation: "Buscar outro canal",
      reason: "Nenhum canal de contato encontrado. Enriqueça o cadastro antes de abordar.",
      urgency: "medium",
      messageSignals: [],
      ctaHint: "Editar dados",
    };
  }

  // ── New leads: first touch or wait window ────────────────────────────────
  if (input.crmStage === "new") {
    if (input.lastContactDays == null) {
      const channel = channelFor(input);
      return {
        channel: channel === "phone" ? "call" : channel,
        recommendation: "Enviar primeira abordagem",
        reason:
          input.whatsappStatus === "verified" || input.whatsappStatus === "possible"
            ? "Lead novo com WhatsApp disponível. Faça o primeiro contato agora."
            : "Lead novo. Faça a primeira abordagem pelo canal disponível.",
        urgency: "high",
        messageSignals: [],
        ctaHint: "Preparar abordagem",
      };
    }
    if (input.lastContactDays < 2) {
      const d = input.lastContactDays;
      return {
        channel: "system",
        recommendation: "Aguardar retorno",
        reason: `Abordado há ${d} dia${d === 1 ? "" : "s"}. Dê tempo antes do próximo toque.`,
        urgency: "low",
        messageSignals: [],
        ctaHint: "Agendar follow-up",
      };
    }
  }

  // ── Contacted leads: cadence machine ─────────────────────────────────────
  if (input.crmStage === "contacted") {
    const stepCount = CADENCE_STEP_DEFS.length;
    if ((input.cadenceStep ?? 0) >= stepCount || input.cadenceCompleted) {
      return {
        channel: "system",
        recommendation: "Definir próximo passo",
        reason:
          "A cadência foi concluída. Registre a resposta ou decida se a oportunidade continua.",
        urgency: "medium",
        messageSignals: [],
        ctaHint: "Abrir detalhes",
      };
    }

    const due = dueCadenceStep(input);
    if (!due) {
      const upcoming = upcomingCadenceStep(input);
      return {
        channel: "system",
        recommendation:
          input.cadenceStartedDays != null ? "Aguardar resposta" : "Confirmar primeiro contato",
        reason:
          upcoming && input.cadenceStartedDays != null
            ? `Próximo toque em ${upcoming.dueAtDay} dias (${upcoming.label.toLowerCase()}).`
            : "A cadência só começa depois que o primeiro contato é confirmado.",
        urgency: "low",
        messageSignals: [],
        ctaHint: input.cadenceStartedDays != null ? "Agendar retorno" : "Abrir detalhes",
      };
    }

    const isLast = due.order === stepCount;
    const days = input.lastContactDays;
    return {
      channel:
        due.channel === "call"
          ? "call"
          : input.whatsappStatus === "verified" || input.whatsappStatus === "possible"
            ? "whatsapp"
            : "call",
      recommendation: due.label,
      reason: `${days ?? "?"} dias sem resposta — toque ${due.order} de ${stepCount} da cadência (${due.label.toLowerCase()}).`,
      urgency: isLast ? "medium" : "high",
      messageSignals: [],
      cadenceStepId: due.id,
      ctaHint: due.channel === "call" ? "Ligar agora" : "Preparar follow-up",
    };
  }

  // ── Qualified leads: concrete commercial next step ───────────────────────
  if (input.crmStage === "qualified") {
    const channel = channelFor(input);
    return {
      channel: channel === "phone" ? "call" : channel,
      recommendation: "Agendar reunião ou enviar proposta",
      reason: "Lead qualificado. Avance para o próximo passo comercial concreto.",
      urgency: "high",
      messageSignals: [],
      ctaHint: "Agendar reunião",
    };
  }

  // ── Legacy/discovery behavior (no funnel context) — UNCHANGED contract ───
  const urgency: NextBestAction["urgency"] =
    input.temperature === "hot" ? "high" : input.temperature === "warm" ? "medium" : "low";

  const signals: string[] = [];
  if (!input.hasWebsite) signals.push("não possui site");
  if (input.rating != null && input.rating >= 4) signals.push("boa avaliação");
  if (input.reviewCount != null && input.reviewCount < 20) signals.push("poucas avaliações");
  if (
    input.crmStage != null &&
    input.crmStage !== "none" &&
    input.lastContactDays != null &&
    input.lastContactDays >= 3
  ) {
    signals.push("sem resposta há alguns dias");
  }

  const reason = signals.length
    ? `Oportunidade por ${signals.join(", ")}.`
    : "Empresa dentro da missão de busca.";

  if (!hasAnyChannel(input)) {
    return {
      channel: "none",
      recommendation: "Aguarde mais dados de contato antes de abordar.",
      reason,
      urgency,
      messageSignals: signals,
    };
  }

  const channel = channelFor(input);
  // Contextual recommendation (V3-C): derived from the SAME honest signals,
  // never a sales-y promise — a no-website business gets a website-oriented
  // opener, a weak-reputation one gets a reputation diagnostic.
  const hasNoWebsite = !input.hasWebsite;
  const hasWeakReputation = input.rating != null && input.rating < 3.5; // SIGNAL_THRESHOLDS.weakReputationMax
  const recommendation = hasNoWebsite
    ? "Oferecer criação de website"
    : hasWeakReputation
      ? "Enviar diagnóstico de reputação"
      : channel === "whatsapp"
        ? "Inicie uma conversa via WhatsApp com uma abordagem consultiva."
        : channel === "email"
          ? "Envie um e-mail de apresentação com uma proposta de valor."
          : "Faça uma ligação de qualificação.";

  return { channel, recommendation, reason, urgency, messageSignals: signals };
}
