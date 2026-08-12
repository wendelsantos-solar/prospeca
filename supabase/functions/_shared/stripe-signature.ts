// Stripe webhook signature verification (HMAC-SHA256 over `${timestamp}.${payload}`).
//
// Pure Web Crypto — runs unmodified under Deno (edge) and Bun (tests).
// `nowMs` is injected so the replay window is deterministic in tests.
//
// Rejects, in order: missing secret/header, unparseable header, no `v1` scheme,
// non-numeric or out-of-tolerance timestamp, and finally any payload whose MAC
// does not match. Every failure path returns false — never throws, never
// defaults to accepting.

/** Stripe's own default tolerance for the `t=` timestamp. */
export const SIGNATURE_TOLERANCE_SEC = 300;

export interface VerifyStripeSignatureInput {
  /** Raw request body, exactly as received. Re-serializing invalidates the MAC. */
  payload: string;
  /** The `Stripe-Signature` header. */
  header: string;
  /** `STRIPE_WEBHOOK_SECRET`. Empty/absent means reject. */
  secret: string;
  /** Current time in ms; injected for determinism. */
  nowMs: number;
  toleranceSec?: number;
}

export async function verifyStripeSignature({
  payload,
  header,
  secret,
  nowMs,
  toleranceSec = SIGNATURE_TOLERANCE_SEC,
}: VerifyStripeSignatureInput): Promise<boolean> {
  if (!secret || !header) return false;

  let timestamp: string | undefined;
  const signatures: string[] = [];

  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) return false;
    const scheme = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (scheme === "t") timestamp = value;
    else if (scheme === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;
  if (!/^\d+$/.test(timestamp)) return false;

  const skewSec = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (skewSec > toleranceSec) return false;

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);

  // No early exit: every candidate is compared so timing does not reveal position.
  let matched = false;
  for (const candidate of signatures) {
    if (constantTimeEqual(candidate, expected)) matched = true;
  }
  return matched;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two hex digests without leaking the position of the first mismatch (CWE-208). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
