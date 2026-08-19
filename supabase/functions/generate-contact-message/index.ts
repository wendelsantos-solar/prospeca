// Generates an AI-written first-contact WhatsApp opener from a lead's real
// signal (no website / low rating / review count). Opt-in only — the
// frontend template stays the default; this is a "Gerar com IA" button.
// Never fabricates a message when the lead lacks real signal (see
// hasEnoughSignal in _shared/ai-message.ts) — returns insufficient_signal
// instead, and the frontend silently falls back to the template.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage } from "../_shared/quota.ts";
import { calculateUsageCost } from "@leads/domain/cost-model";
import {
  hasEnoughSignal,
  buildUserPrompt,
  SYSTEM_PROMPT,
  AI_MESSAGE_MODEL,
  type LeadSignal,
} from "../_shared/ai-message.ts";
import { pickPrimaryDecisionMaker } from "@leads/domain/decision-maker";

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

    // Fase 7: fecha o ciclo do rate limit (mesmo event_type). Custo do
    // Anthropic é POR TOKEN e não medimos tokens — DESCONHECIDO (NULL),
    // nunca 0 (regra dura da fase). Tentativa conta mesmo sem chave.
    const cost = calculateUsageCost("anthropic", "ai_message_generate", 1);
    await recordUsage(ctx.adminClient, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      eventType: "ai_message_generate",
      provider: "anthropic",
      quantity: 1,
      estimatedCostUsd: cost.estimatedCostUsd,
      realCostUsd: cost.realCostUsd,
      costSource: cost.source,
    });

    const { data: lead } = await ctx.userClient
      .from("leads")
      .select(
        "id, company_name, category, city, neighborhood, has_website, rating, review_count, place_id",
      )
      .eq("id", parsed.data.leadId)
      .maybeSingle();
    if (!lead) throw new AppError("LEAD_NOT_FOUND", "Lead não encontrado.");

    // Decisor (People Intelligence) — lido sob a RLS do usuário, como o resto.
    // Falha aqui NUNCA impede a geração: a mensagem sem nome continua útil.
    let decisionMakerName: string | null = null;
    let decisionMakerRole: string | null = null;
    if (lead.place_id) {
      const { data: people } = await ctx.userClient
        .from("company_people")
        .select("role, role_band, decision_score, confidence, is_current, people(full_name)")
        .eq("place_id", lead.place_id)
        .eq("is_current", true);
      const primary = pickPrimaryDecisionMaker(
        (people ?? [])
          .map((row) => ({
            name: (row as unknown as { people?: { full_name?: string } }).people?.full_name ?? "",
            score: (row.decision_score as number | null) ?? 0,
            dataConfidence: (row.confidence as number | null) ?? 0,
            band: (row.role_band as "high" | "medium" | "low" | "unknown" | null) ?? "unknown",
            isCurrent: row.is_current as boolean,
            role: (row.role as string | null) ?? null,
          }))
          .filter((p) => p.name),
      );
      decisionMakerName = primary?.name ?? null;
      decisionMakerRole = primary?.role ?? null;
    }

    const signal: LeadSignal = {
      companyName: lead.company_name,
      category: lead.category,
      city: lead.city,
      neighborhood: lead.neighborhood,
      hasWebsite: lead.has_website,
      rating: lead.rating,
      reviewCount: lead.review_count,
      decisionMakerName,
      decisionMakerRole,
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
