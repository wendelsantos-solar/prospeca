import { whatsappDisplay } from "./whatsapp";
import { isContactSuppressed } from "./suppression";
import { digitsOnly } from "./format";

/**
 * Outbound contact — the single place that decides whether we may message a
 * business and which number we message. Every WhatsApp entry point in the app
 * goes through `planWhatsApp`; nothing else may build a wa.me link.
 *
 * Two rules used to be copy-pasted per call site and forgotten at four of them:
 *   1. LGPD opt-out (suppression list) blocks the contact.
 *   2. A landline is not a WhatsApp — only a scraped `whatsapp` or an inferred
 *      Brazilian mobile may be dialed.
 */

/** Anything with contact fields: a funnel Lead or a discovery result. */
export interface OutboundContact {
  whatsapp?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type WhatsAppRefusal = "no-number" | "not-whatsapp" | "suppressed";

export type WhatsAppPlan =
  | { ok: true; url: string; number: string; probable: boolean }
  | { ok: false; reason: WhatsAppRefusal };

/** pt-BR copy for every refusal — one wording per reason, app-wide. */
export const WHATSAPP_REFUSAL_MESSAGE: Record<WhatsAppRefusal, string> = {
  "no-number": "Sem WhatsApp/telefone",
  "not-whatsapp": "Número fixo — sem WhatsApp",
  suppressed: "Contato em opt-out — não contatar (LGPD).",
};

/** True when a WhatsApp can be resolved at all — use it to decide whether to
 * render a WhatsApp action, so we never offer a button that will be refused.
 * Says nothing about the opt-out list, which is checked at action time. */
export function hasWhatsAppTarget(contact: OutboundContact): boolean {
  return whatsappDisplay(contact.whatsapp, contact.phone) !== null;
}

/**
 * Decides whether this contact may be messaged and returns the link to open.
 * Pure except for the SHA-256 hashing used to test the suppression set.
 *
 * `suppressed` undefined means the opt-out list has not loaded yet; the check is
 * skipped rather than blocking the action (matches the previous per-site rule).
 */
export async function planWhatsApp(
  contact: OutboundContact,
  suppressed: Set<string> | undefined,
  message?: string,
): Promise<WhatsAppPlan> {
  const resolved = whatsappDisplay(contact.whatsapp, contact.phone);
  if (!resolved) {
    // A number exists but isn't a WhatsApp (landline / unparseable) → say so.
    const hasSomething = !!(contact.whatsapp || contact.phone);
    return { ok: false, reason: hasSomething ? "not-whatsapp" : "no-number" };
  }
  const number = digitsOnly(resolved.value);
  if (!number) return { ok: false, reason: "no-number" };

  if (suppressed && (await isContactSuppressed(suppressed, contact))) {
    return { ok: false, reason: "suppressed" };
  }

  const base = `https://wa.me/${number}`;
  return {
    ok: true,
    url: message ? `${base}?text=${encodeURIComponent(message)}` : base,
    number,
    probable: resolved.probable,
  };
}
