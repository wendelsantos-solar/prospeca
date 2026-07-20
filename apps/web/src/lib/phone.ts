// Brazilian phone normalization — mirror of supabase/functions/_shared/normalize.ts.
// Keep both in sync when changing rules.

export interface NormalizedPhone {
  raw: string;
  e164?: string;
  countryCode?: string;
  areaCode?: string;
  isValid: boolean;
  type: "mobile" | "landline" | "unknown";
}

export type WhatsAppStatus = "unknown" | "possible" | "verified" | "invalid";

const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function normalizePhone(raw: string): NormalizedPhone {
  const digits = raw.replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("55") && national.length >= 12) national = national.slice(2);
  if (national.startsWith("0")) national = national.slice(1);

  if (national.length !== 10 && national.length !== 11) {
    return { raw, isValid: false, type: "unknown" };
  }
  const ddd = parseInt(national.slice(0, 2), 10);
  if (!VALID_DDDS.has(ddd)) return { raw, isValid: false, type: "unknown" };

  const subscriber = national.slice(2);
  const isMobile = subscriber.length === 9 && subscriber.startsWith("9");
  const isLandline = subscriber.length === 8 && /^[2-5]/.test(subscriber);
  if (!isMobile && !isLandline) return { raw, isValid: false, type: "unknown" };

  return {
    raw,
    e164: `+55${national}`,
    countryCode: "55",
    areaCode: String(ddd),
    isValid: true,
    type: isMobile ? "mobile" : "landline",
  };
}

/** A mobile number is only ever "possible" — never assume verified. */
export function whatsappStatusFor(phone: NormalizedPhone): WhatsAppStatus {
  if (!phone.isValid) return "invalid";
  return phone.type === "mobile" ? "possible" : "unknown";
}

/** wa.me link — digits only, DDI included. Returns null when invalid. */
export function waMeLink(raw: string, message?: string): string | null {
  const phone = normalizePhone(raw);
  if (!phone.isValid || !phone.e164) return null;
  const base = `https://wa.me/${phone.e164.replace("+", "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
