import { normalizePhone } from "@leads/domain";

export interface WhatsappDisplay {
  value: string;
  /** true when the number was inferred from a mobile phone (weaker evidence). */
  probable: boolean;
  /** De onde veio o número. NENHUMA das duas origens é validação: enquanto
   * WHATSAPP_VALIDATION não tiver provider, nada é 'verified'. A distinção
   * existe porque a força da evidência difere — um número publicado como
   * WhatsApp no site da empresa vale mais que "é celular, logo provavelmente
   * tem WhatsApp" — e o vendedor merece saber em qual dos dois está apostando. */
  source: "site" | "inferido";
}

/**
 * Resolves what to show in a WhatsApp field. A scraped `whatsapp` wins over an
 * inferred mobile. NEITHER is verified: confirming a WhatsApp account requires
 * the WhatsApp Business API (job type WHATSAPP_VALIDATION, sem provider hoje).
 * A UI deve qualificar os dois — apresentar o raspado como certo foi o defeito
 * que a Fase 6 corrigiu. Landlines / invalid numbers yield null.
 */
export function whatsappDisplay(
  whatsapp: string | null | undefined,
  phone: string | null | undefined,
): WhatsappDisplay | null {
  if (whatsapp) return { value: whatsapp, probable: false, source: "site" };
  if (!phone) return null;
  const p = normalizePhone(phone);
  if (p.isValid && p.type === "mobile" && p.e164)
    return { value: p.e164, probable: true, source: "inferido" };
  return null;
}
