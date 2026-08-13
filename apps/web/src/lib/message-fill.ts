import { categoryLabel } from "@/lib/category";

/** The subset of a lead/discovery result a message template can reference. */
export interface MessageContact {
  companyName: string;
  category?: string;
  city?: string;
  neighborhood?: string;
  phone?: string | null;
  instagram?: string | null;
  website?: string | null;
  hasWebsite?: boolean;
  rating?: number | null;
  reviewCount?: number | null;
}

/**
 * Grounded reason for the contact, derived from the lead's REAL signal — the
 * opposite of a generic "tenho uma oportunidade pra você". This is what makes
 * the opener read as a genuine, specific insight instead of a sales pitch.
 */
export function contactReason(contact: MessageContact): string {
  if (contact.hasWebsite === false) return "não tem site próprio";
  if (contact.rating != null && contact.rating < 4.0) {
    return `tem avaliações abaixo da média (nota ${contact.rating.toFixed(1)})`;
  }
  if (contact.reviewCount === 0) return "não tem avaliações online";
  return "ainda dá para melhorar a presença digital";
}

export interface MessageSender {
  /** Display name used for `{{meu_nome}}` (falls back to the account name). */
  senderName?: string;
  userName?: string;
  companyName?: string;
  /** Appended after a blank line when present. */
  signature?: string;
}

/** Replaces `{{var}}` placeholders; unknown vars collapse to an empty string. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * Single source of truth for turning the saved template into the message sent
 * to one contact. Shared by the bulk dialog and the per-lead composer so both
 * resolve the same variables and append the signature the same way.
 */
export function buildContactMessage(
  template: string,
  contact: MessageContact,
  sender: MessageSender = {},
  /** Cadence step opening line (see lib/cadence.ts) — prepended before the
   * templated body so a follow-up doesn't read as the exact same first
   * message resent. */
  opener?: string,
): string {
  const filled = fillTemplate(template, {
    empresa: contact.companyName,
    categoria: contact.category ? categoryLabel(contact.category).toLowerCase() : "",
    cidade: contact.city ?? "",
    bairro: contact.neighborhood ?? "",
    telefone: contact.phone ?? "",
    instagram: contact.instagram ?? "",
    website: contact.website ?? "",
    meu_nome: sender.senderName || sender.userName || "",
    minha_empresa: sender.companyName ?? "",
    responsavel: "",
    razao_contato: contactReason(contact),
  });
  const base = opener ? `${opener}\n\n${filled}` : filled;
  return sender.signature ? `${base}\n\n${sender.signature}` : base;
}
