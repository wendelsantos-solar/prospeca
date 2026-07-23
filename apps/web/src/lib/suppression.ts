import { normalizePhone } from "@leads/domain";
import { digitsOnly } from "./format";

export type SuppressionType = "phone" | "email";

export interface SuppressionEntry {
  type: SuppressionType;
  value_hash: string;
  reason?: string;
}

/** Normalize a contact value so the same contact always hashes identically. */
function normalizeValue(type: SuppressionType, value: string): string {
  if (type === "email") return value.trim().toLowerCase();
  // phone → e164 when parseable, else bare digits.
  const p = normalizePhone(value);
  return p.isValid && p.e164 ? p.e164 : digitsOnly(value);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash a contact value for the suppression list (never stores raw PII). Namespaced
 * by type so a phone and an email that stringify alike can't collide. */
export function suppressionHash(type: SuppressionType, value: string): Promise<string> {
  return sha256Hex(`${type}:${normalizeValue(type, value)}`);
}

/** Build suppression rows for a business's contacts (present ones only). */
export async function suppressionEntriesFor(input: {
  phone?: string | null;
  email?: string | null;
  reason?: string;
}): Promise<SuppressionEntry[]> {
  const entries: SuppressionEntry[] = [];
  if (input.phone && digitsOnly(input.phone)) {
    entries.push({
      type: "phone",
      value_hash: await suppressionHash("phone", input.phone),
      reason: input.reason,
    });
  }
  if (input.email && input.email.includes("@")) {
    entries.push({
      type: "email",
      value_hash: await suppressionHash("email", input.email),
      reason: input.reason,
    });
  }
  return entries;
}

/** True if any of the contact's values is in the suppressed-hash set. */
export async function isContactSuppressed(
  suppressedHashes: Set<string>,
  input: { phone?: string | null; email?: string | null },
): Promise<boolean> {
  if (input.phone && digitsOnly(input.phone)) {
    if (suppressedHashes.has(await suppressionHash("phone", input.phone))) return true;
  }
  if (input.email && input.email.includes("@")) {
    if (suppressedHashes.has(await suppressionHash("email", input.email))) return true;
  }
  return false;
}
