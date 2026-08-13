// score-company: computes the V2 per-organization opportunity score (signals +
// multi-component) for one or many places and persists it to
// company_opportunity_scores. Complements the legacy calculate-lead-score,
// which still owns `leads.score` (single-formula v3.0.0).
//
// Intent/territory inputs are org-specific; this first wire-up scores from the
// deterministic signals only (neutral intent/territory), which is a valid,
// explainable score. Those dimensions get populated as Territory/NBA jobs land.

import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { scoreInputFromRow, type PlaceRow } from "@leads/domain/score-input";
import { deriveSignals } from "@leads/domain/signals";
import {
  calculateOpportunityScore,
  OPPORTUNITY_SCORE_VERSION,
  opportunityTemperatureFromScore,
} from "@leads/domain/opportunity-score";

const InputSchema = z.object({
  placeIds: z.array(z.string().uuid()).min(1).max(200),
  searchId: z.string().uuid().optional(),
});

type PlaceRowWithId = PlaceRow & { id: string };

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    // Tenant check: the referenced search must belong to the caller's org.
    if (parsed.data.searchId) {
      const { data: search } = await ctx.userClient
        .from("searches")
        .select("id")
        .eq("id", parsed.data.searchId)
        .eq("organization_id", ctx.organizationId)
        .maybeSingle();
      if (!search) throw new AppError("NOT_FOUND", "Busca não encontrada.");
    }

    const { data: places } = await ctx.userClient
      .from("places")
      .select(
        "id, website_uri, national_phone_number, international_phone_number, primary_type, types, email, instagram, whatsapp, rating, user_rating_count, business_status",
      )
      .in("id", parsed.data.placeIds);

    let updated = 0;
    for (const row of (places ?? []) as PlaceRowWithId[]) {
      const input = scoreInputFromRow(row, null);
      const signals = deriveSignals({
        hasWebsite: input.hasWebsite,
        hasValidPhone: input.hasValidPhone,
        whatsappStatus: input.whatsappStatus,
        hasEmail: input.hasEmail,
        rating: input.rating,
        reviewCount: input.reviewCount,
        businessStatus: input.businessStatus,
      });

      const opp = calculateOpportunityScore({
        signals,
        rating: input.rating,
        reviewCount: input.reviewCount,
        hasWebsite: input.hasWebsite,
        whatsappStatus: input.whatsappStatus,
        intentMatch: null,
        territoryFavorability: null,
        freshnessDays: null,
      });

      const { error } = await ctx.adminClient.from("company_opportunity_scores").upsert(
        {
          organization_id: ctx.organizationId,
          place_id: row.id,
          search_id: parsed.data.searchId ?? null,
          score: opp.total,
          temperature: opportunityTemperatureFromScore(opp.total),
          rule_version: OPPORTUNITY_SCORE_VERSION,
          breakdown: opp,
          confidence: opp.confidence,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,place_id,rule_version" },
      );
      if (!error) updated++;
    }

    logEvent({ requestId, operation: "score-company", status: "ok", resultCount: updated });
    return json({ updated, ruleVersion: OPPORTUNITY_SCORE_VERSION }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
