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
  });
  const base = opener ? `${opener}\n\n${filled}` : filled;
  return sender.signature ? `${base}\n\n${sender.signature}` : base;
}
