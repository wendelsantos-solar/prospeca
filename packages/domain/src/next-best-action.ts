// Next Best Action — deterministic recommendation of the next commercial step
// (spec #56). Pure logic; the AI enriches the actual message copy (spec #57 —
// generate → review → user decides to send, never auto-send).

export interface NextBestActionInput {
  hasWebsite: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  rating: number | null;
  reviewCount: number | null;
  temperature: "hot" | "warm" | "cold";
  score: number;
  crmState?: "none" | "new" | "qualified" | "contacted";
  lastContactDays?: number | null;
}

export interface NextBestAction {
  channel: "whatsapp" | "email" | "phone" | "none";
  recommendation: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  /** Structured signals that should inform the generated message. */
  messageSignals: string[];
}

export function recommendNextBestAction(input: NextBestActionInput): NextBestAction {
  // Channel: prefer the fastest reliable channel the company actually has.
  let channel: NextBestAction["channel"];
  if (input.whatsappStatus === "verified" || input.whatsappStatus === "possible") {
    channel = "whatsapp";
  } else if (input.hasEmail) {
    channel = "email";
  } else if (input.hasPhone) {
    channel = "phone";
  } else {
    channel = "none";
  }

  const urgency: NextBestAction["urgency"] =
    input.temperature === "hot" ? "high" : input.temperature === "warm" ? "medium" : "low";

  const signals: string[] = [];
  if (!input.hasWebsite) signals.push("não possui site");
  if (input.rating != null && input.rating >= 4) signals.push("boa avaliação");
  if (input.reviewCount != null && input.reviewCount < 20) signals.push("poucas avaliações");
  if (input.crmState === "contacted" && input.lastContactDays != null && input.lastContactDays >= 3) {
    signals.push("sem resposta há alguns dias");
  }

  const reason = signals.length
    ? `Oportunidade por ${signals.join(", ")}.`
    : "Empresa dentro da missão de busca.";

  const recommendation =
    channel === "whatsapp"
      ? "Inicie uma conversa via WhatsApp com uma abordagem consultiva."
      : channel === "email"
        ? "Envie um e-mail de apresentação com uma proposta de valor."
        : channel === "phone"
          ? "Faça uma ligação de qualificação."
          : "Aguarde mais dados de contato antes de abordar.";

  return { channel, recommendation, reason, urgency, messageSignals: signals };
}
