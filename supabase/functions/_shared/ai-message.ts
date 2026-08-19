// Pure logic for the "AI first-contact message" feature (roadmap 3.5). No I/O
// here — the edge function (generate-contact-message/index.ts) owns the
// Anthropic fetch call and the DB read. Kept separate and dependency-free so
// it runs under `bun test` despite living in the Deno functions tree (same
// convention as _shared/refresh.ts / refresh.test.ts).

export interface LeadSignal {
  companyName: string;
  category: string | null;
  city: string | null;
  neighborhood: string | null;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  /**
   * Decisor identificado no quadro societário (People Intelligence). Nome e
   * cargo são dados PÚBLICOS de registro — entram no prompt para a abertura
   * falar com uma pessoa em vez de falar com uma fachada.
   */
  decisionMakerName?: string | null;
  decisionMakerRole?: string | null;
}

export const AI_MESSAGE_MODEL = "claude-haiku-4-5-20251001";

export const SYSTEM_PROMPT = `Você escreve a abertura de uma mensagem de WhatsApp de primeiro contato comercial B2B, em português do Brasil, para um vendedor abordar um negócio local.

Regras:
- 2 a 3 frases, tom consultivo e direto, nunca genérico ou robótico.
- Baseie-se SOMENTE nos dados fornecidos. Nunca invente fatos, números ou observações que não vieram no prompt.
- Nunca comece com saudação genérica tipo "Olá, tudo bem?" — vá direto ao motivo do contato.
- Não assine, não use placeholders como {{empresa}} — escreva o nome da empresa por extenso quando fizer sentido.
- Quando o prompt informar um decisor, dirija-se a ele pelo PRIMEIRO NOME. Nunca cite o cargo societário nem diga como você descobriu quem ele é — soa invasivo e o dado é só contexto seu.
- Se nenhum decisor for informado, não invente nome nem trate a empresa por um nome de pessoa.
- Responda apenas com o texto da mensagem, sem aspas, sem explicação.`;

/** Server-side gate on whether there's enough real signal to bother the LLM.
 * Never generate a message that would read as specific when it isn't. */
export function hasEnoughSignal(lead: LeadSignal): boolean {
  if (!lead.hasWebsite) return true;
  if (lead.rating != null && lead.rating < 4.0 && (lead.reviewCount ?? 0) >= 3) return true;
  if (lead.reviewCount === 0 && lead.hasWebsite) return true;
  return false;
}

export function buildUserPrompt(lead: LeadSignal): string {
  const lines: string[] = [`Empresa: ${lead.companyName}`];
  if (lead.category) lines.push(`Categoria: ${lead.category.replaceAll("_", " ")}`);
  if (lead.city) lines.push(`Cidade: ${lead.city}`);
  if (lead.neighborhood) lines.push(`Bairro: ${lead.neighborhood}`);
  lines.push(`Tem site: ${lead.hasWebsite ? "sim" : "não"}`);
  if (lead.rating != null) lines.push(`Nota: ${lead.rating}`);
  if (lead.reviewCount != null) lines.push(`Número de avaliações: ${lead.reviewCount}`);
  // O cargo vai junto para o modelo calibrar o tom (falar com um sócio não é
  // falar com um gerente), com a instrução do sistema proibindo citá-lo.
  if (lead.decisionMakerName) {
    lines.push(
      lead.decisionMakerRole
        ? `Decisor: ${lead.decisionMakerName} (${lead.decisionMakerRole})`
        : `Decisor: ${lead.decisionMakerName}`,
    );
  }
  return lines.join("\n");
}
