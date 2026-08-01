// Generates an AI-written first-contact WhatsApp opener from a lead's real
// signal (no website / low rating / review count). Opt-in only — the
// frontend template stays the default; this is a "Gerar com IA" button.
// Never fabricates a message when the lead lacks real signal (see
// hasEnoughSignal in _shared/ai-message.ts) — returns insufficient_signal
// instead, and the frontend silently falls back to the template.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import {
  hasEnoughSignal,
  buildUserPrompt,
  SYSTEM_PROMPT,
  AI_MESSAGE_MODEL,
  type LeadSignal,
} from "../_shared/ai-message.ts";

const InputSchema = z.object({ leadId: z.string().uuid() });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "ai_message_generate", 10);

    const { data: lead } = await ctx.userClient
      .from("leads")
      .select("id, company_name, category, city, neighborhood, has_website, rating, review_count")
      .eq("id", parsed.data.leadId)
      .maybeSingle();
    if (!lead) throw new AppError("LEAD_NOT_FOUND", "Lead não encontrado.");

    const signal: LeadSignal = {
      companyName: lead.company_name,
      category: lead.category,
      city: lead.city,
      neighborhood: lead.neighborhood,
      hasWebsite: lead.has_website,
      rating: lead.rating,
      reviewCount: lead.review_count,
    };

    if (!hasEnoughSignal(signal)) {
      logEvent({ requestId, operation: "generate-contact-message", status: "insufficient_signal" });
      return json({ ok: false, reason: "insufficient_signal" }, 200, {}, req);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      logEvent({ requestId, operation: "generate-contact-message", status: "no_api_key" });
      return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MESSAGE_MODEL,
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(signal) }],
        }),
      });

      if (!res.ok) {
        logEvent({
          requestId,
          operation: "generate-contact-message",
          status: "provider_error",
          httpStatus: res.status,
        });
        return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
      }

      const data = await res.json();
      const message = (data?.content?.[0]?.text ?? "").trim();
      if (!message) {
        logEvent({ requestId, operation: "generate-contact-message", status: "empty_completion" });
        return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
      }

      logEvent({ requestId, operation: "generate-contact-message", status: "ok" });
      return json({ ok: true, message }, 200, {}, req);
    } catch (err) {
      logEvent({
        requestId,
        operation: "generate-contact-message",
        status: "fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      });
      return json({ ok: false, reason: "generation_failed" }, 200, {}, req);
    }
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
