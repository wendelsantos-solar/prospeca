import { normalizePhone } from "@leads/domain";

export interface WhatsappDisplay {
  value: string;
  /** true when the number was inferred from a mobile phone (not scraped/verified). */
  probable: boolean;
}

/**
 * Resolves what to show in a WhatsApp field. A scraped/verified `whatsapp` wins.
 * Otherwise, a Brazilian mobile phone is a very likely WhatsApp — surface it as
 * "probable". Landlines / invalid numbers yield null. We never truly verify a
 * WhatsApp account here (that needs the WhatsApp Business API); this is inference.
 */
export function whatsappDisplay(
  whatsapp: string | null | undefined,
  phone: string | null | undefined,
): WhatsappDisplay | null {
  if (whatsapp) return { value: whatsapp, probable: false };
  if (!phone) return null;
  const p = normalizePhone(phone);
  if (p.isValid && p.type === "mobile" && p.e164) return { value: p.e164, probable: true };
  return null;
}
