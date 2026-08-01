// calculate-lead-score: recomputes the deterministic, versioned score
// for one or many leads (e.g. after a rule version bump).
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "@leads/domain/score";

const InputSchema = z.object({ leadIds: z.array(z.string().uuid()).min(1).max(100) });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    const { data: leads } = await ctx.userClient
      .from("leads")
      .select(
        "id, has_website, phone_e164, whatsapp_status, email, instagram, category, rating, review_count",
      )
      .in("id", parsed.data.leadIds);

    let updated = 0;
    for (const lead of leads ?? []) {
      const breakdown = calculateScore({
        hasWebsite: lead.has_website,
        hasValidPhone: !!lead.phone_e164,
        whatsappStatus: lead.whatsapp_status,
        hasEmail: !!lead.email,
        hasInstagram: !!lead.instagram,
        hasCategory: !!lead.category,
        rating: lead.rating,
        reviewCount: lead.review_count,
        distanceMeters: null,
        businessStatus: null,
      });
      await ctx.userClient
        .from("leads")
        .update({
          score: breakdown.total,
          score_breakdown: breakdown,
          score_rule_version: SCORE_RULE_VERSION,
          temperature: temperatureFromScore(breakdown.total),
        })
        .eq("id", lead.id);
      updated++;
    }

    logEvent({ requestId, operation: "calculate-lead-score", status: "ok", resultCount: updated });
    return json({ updated, ruleVersion: SCORE_RULE_VERSION }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
