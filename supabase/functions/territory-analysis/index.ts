// territory-analysis: server-side territory aggregation for a search (spec
// #37–41) + favorability feedback into the opportunity score.
//
// Modes:
//   - Authenticated (frontend trigger) — org from the JWT.
//   - Internal (service-role): fired by the process-jobs worker for a claimed
//     TERRITORY_ANALYSIS job. `organizationId` from the body, validated against
//     the search; `jobId` (worker) is closed with complete/fail via the queue.
//
// Flow: reads search_results ⋈ places (server-side — NOT the frontend sample),
// derives neighborhood/city from the stored Google address (parseAddress — the
// same pure rule the frontend uses), groups with resolveTerritoryGroupBy +
// aggregateTerritories + buildTerritoryInsights (pure domain), persists
// territory_stats, computes territoryFavorabilityFor per region and re-scores
// the search's places via score-company (internal) with the favorability map.
//
// Honesty: regions below MIN_TERRITORY_SAMPLE get NO favorability (null → the
// score's territory component stays neutral). Never invent.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { fireAndForget } from "../_shared/dispatch.ts";
import { createSupabaseJobQueue, stampJobMetrics } from "../_shared/job-queue.ts";
import { parseAddress } from "@leads/domain/address";
import {
  aggregateTerritories,
  buildTerritoryInsights,
  confidenceFromSample,
  resolveTerritoryGroupBy,
  territoryFavorabilityFor,
  territoryKeyForCompany,
  type TerritoryCompany,
  type TerritoryGroupBy,
  type TerritoryStats,
} from "@leads/domain/territory";

const InputSchema = z
  .object({
    searchId: z.string().uuid(),
    /** Internal (service-role) calls only — validated against the search. */
    organizationId: z.string().uuid().optional(),
    /** Worker path: the claimed TERRITORY_ANALYSIS job to close. */
    jobId: z.string().uuid().optional(),
  })
  .refine((v) => v.organizationId || !v.jobId, {
    message: "jobId exige organização (chamada interna).",
  });

type ResultRow = {
  place_id: string;
  distance_meters: number | null;
  score: number | null;
  temperature: string | null;
  places: {
    id: string;
    formatted_address: string | null;
    address_components: unknown;
    website_uri: string | null;
  } | null;
};

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  let jobId: string | null = null;

  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    jobId = parsed.data.jobId ?? null;
    const { searchId } = parsed.data;

    const internal = await isInternalCall(req);
    let organizationId: string;
    if (internal) {
      organizationId = parsed.data.organizationId ?? "";
      if (!organizationId) {
        throw new AppError("VALIDATION_ERROR", "organizationId obrigatório (chamada interna).");
      }
    } else {
      const ctx = await requireAuth(req);
      organizationId = ctx.organizationId;
    }

    const admin = adminClient();

    // Tenant proof: the search must belong to the org.
    const { data: search } = await admin
      .from("searches")
      .select("id, organization_id")
      .eq("id", searchId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");

    const { data: rows } = await admin
      .from("search_results")
      .select(
        "place_id, distance_meters, score, temperature, places(id, formatted_address, address_components, website_uri)",
      )
      .eq("search_id", searchId)
      .limit(1000);

    const companies: TerritoryCompany[] = [];
    for (const r of (rows ?? []) as unknown as ResultRow[]) {
      const p = r.places;
      if (!p) continue;
      const parts = parseAddress(p.formatted_address, p.address_components);
      companies.push({
        id: p.id,
        neighborhood: parts.neighborhood,
        city: parts.city,
        score: r.score ?? 0,
        temperature: (r.temperature as "hot" | "warm" | "cold") ?? "cold",
        hasWebsite: p.website_uri != null && p.website_uri !== "",
      });
    }

    // Effective grouping — neighborhood only if at least one company has one.
    const groupBy: TerritoryGroupBy = resolveTerritoryGroupBy(
      companies.map((c) => ({ neighborhood: c.neighborhood, city: c.city })),
    );

    const stats: TerritoryStats[] = aggregateTerritories(companies, groupBy);
    const insights = buildTerritoryInsights(stats);

    // Persist: one series per search — remove rows grouped differently (the
    // effective groupBy can change as new places land).
    await admin.from("territory_stats").delete().eq("search_id", searchId).neq("group_by", groupBy);

    for (const t of stats) {
      await admin.from("territory_stats").upsert(
        {
          organization_id: organizationId,
          search_id: searchId,
          group_by: groupBy,
          key: t.key,
          company_count: t.companyCount,
          hot_count: t.hotCount,
          avg_score: t.avgScore,
          without_website_ratio: t.withoutWebsiteRatio,
          confidence: confidenceFromSample(t.companyCount),
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,search_id,group_by,key" },
      );
    }

    // Favorability per place → re-score via score-company (internal, idempotent
    // upsert). Only places whose region has a real sample get a value; the
    // rest keep the neutral territory component.
    const favorabilityByPlace: Record<string, number> = {};
    const groupKeyByPlace = new Map<string, string>();
    for (const c of companies) {
      const key = territoryKeyForCompany(c.neighborhood, c.city, groupBy);
      if (key) groupKeyByPlace.set(c.id, key);
    }
    for (const [placeId, key] of groupKeyByPlace) {
      const favor = territoryFavorabilityFor(stats, insights, key);
      if (favor != null) favorabilityByPlace[placeId] = favor;
    }

    if (Object.keys(favorabilityByPlace).length > 0) {
      fireAndForget("score-company", {
        searchId,
        organizationId,
        territoryFavorabilityByPlace: favorabilityByPlace,
      });
    }

    if (jobId) {
      const queue = createSupabaseJobQueue(admin);
      await stampJobMetrics(admin, jobId, {
        // Análise territorial é computação local — zero COMPROVADO.
        realCostUsd: 0,
        estimatedCostUsd: 0,
        costSource: "measured",
      });
      await queue.complete(jobId, {
        territories: stats.length,
        groupBy,
        favorabilityPlaces: Object.keys(favorabilityByPlace).length,
      });
    }

    logEvent({
      requestId,
      searchId,
      organizationId,
      operation: "territory-analysis",
      status: "ok",
      territoryCount: stats.length,
      insightCount: insights.length,
      groupBy,
      favorabilityPlaces: Object.keys(favorabilityByPlace).length,
    });
    return json(
      {
        groupBy,
        territories: stats,
        insights,
        favorabilityPlaces: Object.keys(favorabilityByPlace).length,
      },
      200,
      {},
      req,
    );
  } catch (err) {
    if (jobId) {
      const queue = createSupabaseJobQueue(adminClient());
      await stampJobMetrics(adminClient(), jobId, {
        realCostUsd: 0,
        estimatedCostUsd: 0,
        costSource: "measured",
      }).catch(() => {});
      await queue
        .fail(
          jobId,
          err instanceof AppError ? { status: 422, message: err.message, name: err.code } : err,
        )
        .catch(() => {});
    }
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "territory-analysis", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
