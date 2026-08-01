import { invokeFunction } from "@/lib/supabase";

export type GenerateContactMessageResult =
  | { ok: true; message: string }
  | { ok: false; reason: "insufficient_signal" | "generation_failed" };

/**
 * Generates an AI-written first-contact opener from the lead's real signal
 * (see supabase/functions/_shared/ai-message.ts for the heuristic). Never
 * throws — any failure (network, rate limit, provider down) collapses to
 * `{ ok: false, reason: "generation_failed" }` so the caller can silently
 * keep the template draft instead of showing a blocking error.
 */
export async function generateContactMessage(
  leadId: string,
): Promise<GenerateContactMessageResult> {
  try {
    return await invokeFunction<GenerateContactMessageResult>("generate-contact-message", {
      leadId,
    });
  } catch {
    return { ok: false, reason: "generation_failed" };
  }
}
