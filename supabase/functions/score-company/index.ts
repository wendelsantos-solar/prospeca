// score-company: computes the V2 per-organization opportunity score (signals +
// multi-component) for one or many places and persists it to
// company_opportunity_scores. Complements the legacy calculate-lead-score,
// which still owns `leads.score` (single-formula v3.0.0) — the funnel is
// untouched by this function.
//
// Since v1.1.0 the V2 breakdown also carries a confidence band, and when the
// call references a search the V2 result is written back to
// search_results.score/temperature/score_breakdown — the DISCOVERY contract
// (get_search_discovery returns those columns, RPC unchanged). The intent-match
// component is now REAL: derived from the mission persisted on the search
// (canonical_category/places_types/presence_filter/radius) via the pure
// intentMatchForCompany rule.
//
// Call modes:
//   - Authenticated (frontend): placeIds from the caller, org from the JWT.
//     Intent falls back to the most recent search of each place in the org.
//   - Internal (service role): fired by execute-search / import-search-results
//     / the process-jobs worker. `organizationId` comes from the body and is
//     validated against the referenced search. `placeIds` may be omitted — the
//     function resolves them from the search's search_results. `jobId` (worker)
//     is closed with complete/fail via the queue classification.

import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { createSupabaseJobQueue, stampJobMetrics } from "../_shared/job-queue.ts";
import { scoreInputFromRow, type PlaceRow } from "@leads/domain/score-input";
import { deriveSignals, buildSignalEvidence, type SignalContext } from "@leads/domain/signals";
import type { EnrichmentSourceMap } from "@leads/domain/enrichment-state";
import { yearsInBusiness } from "@leads/domain/business-registry";
import {
  calculateOpportunityScore,
  OPPORTUNITY_SCORE_VERSION,
  opportunityTemperatureFromScore,
} from "@leads/domain/opportunity-score";
import { intentMatchForCompany } from "@leads/domain/intent-match";
import { parseAddress } from "@leads/domain/address";
import {
  buildTerritoryInsights,
  territoryFavorabilityFor,
  territoryKeyForCompany,
  type TerritoryGroupBy,
  type TerritoryStats,
} from "@leads/domain/territory";

const InputSchema = z
  .object({
    placeIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    searchId: z.string().uuid().optional(),
    /** Internal (service-role) calls only — validated against the search. */
    organizationId: z.string().uuid().optional(),
    /** Worker path: the claimed OPPORTUNITY_SCORING job to close (complete/fail). */
    jobId: z.string().uuid().optional(),
    /** Favorability per place (0..1) computed by territory-analysis. */
    territoryFavorabilityByPlace: z.record(z.string().uuid(), z.number().min(0).max(1)).optional(),
  })
  .refine((v) => v.searchId || (v.placeIds?.length ?? 0) > 0, {
    message: "searchId ou placeIds é obrigatório.",
  })
  .refine((v) => v.organizationId || !v.jobId, {
    message: "jobId exige organização (chamada interna).",
  });

type PlaceRowWithId = PlaceRow & {
  id: string;
  formatted_address?: string | null;
  address_components?: unknown;
  enrichment_sources?: EnrichmentSourceMap | null;
  founded_at?: string | null;
};

/** Mission shape persisted on `searches` — the input of intentMatchForCompany. */
interface SearchMission {
  query: string | null;
  canonicalCategory: string | null;
  placesTypes: string[];
  presenceFilter: "without_website" | "with_website" | "all" | null;
  radiusMeters: number | null;
}

function missionFromSearch(search: Record<string, unknown>): SearchMission {
  const placesTypes = ((search.places_types as string[] | null) ?? []).filter(
    (t): t is string => typeof t === "string",
  );
  const presence = search.presence_filter as string | null;
  return {
    query: (search.query as string | null) ?? null,
    canonicalCategory: (search.canonical_category as string | null) ?? null,
    placesTypes,
    presenceFilter:
      presence === "without_website" || presence === "with_website" || presence === "all"
        ? presence
        : null,
    radiusMeters: typeof search.radius_meters === "number" ? search.radius_meters : null,
  };
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  let jobId: string | null = null;

  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    jobId = parsed.data.jobId ?? null;
    const jobQueue = createSupabaseJobQueue(adminClient());

    const internal = await isInternalCall(req);
    let organizationId: string;
    let readClient: ReturnType<typeof adminClient>;
    const admin = adminClient();

    if (internal) {
      // Service-role path (post-search triggers + worker). The org id is
      // carried in the body and proven against the search below.
      organizationId = parsed.data.organizationId ?? "";
      if (!organizationId) {
        throw new AppError("VALIDATION_ERROR", "organizationId obrigatório (chamada interna).");
      }
      readClient = admin;
    } else {
      const ctx = await requireAuth(req);
      organizationId = ctx.organizationId;
      readClient = ctx.userClient; // RLS-scoped reads for authenticated callers
    }

    // Tenant check: the referenced search must belong to the caller's org, and
    // it is the source of place ids + distance + mission when provided.
    let placeIds = parsed.data.placeIds ?? [];
    let mission: SearchMission | null = null;
    const missionByPlace = new Map<string, SearchMission | null>();
    const distanceByPlace = new Map<string, number | null>();

    if (parsed.data.searchId) {
      const { data: search } = await admin
        .from("searches")
        .select("id, query, canonical_category, places_types, presence_filter, radius_meters")
        .eq("id", parsed.data.searchId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!search) throw new AppError("NOT_FOUND", "Busca não encontrada.");
      mission = missionFromSearch(search as Record<string, unknown>);

      const { data: results } = await admin
        .from("search_results")
        .select("place_id, distance_meters")
        .eq("search_id", parsed.data.searchId)
        .limit(1000);
      for (const r of (results ?? []) as Array<{
        place_id: string;
        distance_meters: number | null;
      }>) {
        if (!distanceByPlace.has(r.place_id)) {
          distanceByPlace.set(r.place_id, r.distance_meters);
        }
      }
      if (placeIds.length === 0) placeIds = [...distanceByPlace.keys()];
    } else if (placeIds.length > 0) {
      // Fallback (authenticated, no searchId): the most recent search of each
      // place in the org supplies the mission + distance.
      interface SearchRefRow {
        place_id: string;
        distance_meters: number | null;
        searches:
          | {
              query: string | null;
              canonical_category: string | null;
              places_types: string[] | null;
              presence_filter: string | null;
              radius_meters: number | null;
              created_at: string | null;
            }
          | Array<{
              query: string | null;
              canonical_category: string | null;
              places_types: string[] | null;
              presence_filter: string | null;
              radius_meters: number | null;
              created_at: string | null;
            }>
          | null;
      }
      const { data: srs } = await admin
        .from("search_results")
        .select(
          "place_id, distance_meters, searches(query, canonical_category, places_types, presence_filter, radius_meters, created_at)",
        )
        .in("place_id", placeIds)
        .limit(1000);
      const latestByPlace = new Map<
        string,
        { mission: SearchMission; distance: number | null; createdAt: string }
      >();
      for (const r of (srs ?? []) as unknown as SearchRefRow[]) {
        const searchRow = Array.isArray(r.searches) ? (r.searches[0] ?? null) : r.searches;
        if (!searchRow) continue;
        const candidate = {
          mission: missionFromSearch(searchRow as unknown as Record<string, unknown>),
          distance: r.distance_meters,
          createdAt: searchRow.created_at ?? "",
        };
        const current = latestByPlace.get(r.place_id);
        if (!current || candidate.createdAt > current.createdAt) {
          latestByPlace.set(r.place_id, candidate);
        }
      }
      for (const [placeId, entry] of latestByPlace) {
        missionByPlace.set(placeId, entry.mission);
        if (!distanceByPlace.has(placeId)) distanceByPlace.set(placeId, entry.distance);
      }
    }

    if (placeIds.length === 0) {
      // Nothing to score — the worker's job is still satisfied (honest no-op).
      if (jobId) {
        await stampJobMetrics(admin, jobId, {
          // Scoring é computação local sobre dados já persistidos — nenhuma
          // chamada paga de provider: zero COMPROVADO ('measured').
          realCostUsd: 0,
          estimatedCostUsd: 0,
          costSource: "measured",
        });
        await jobQueue.complete(jobId, { updated: 0, reason: "no places" });
      }
      return json({ updated: 0, ruleVersion: OPPORTUNITY_SCORE_VERSION }, 200, {}, req);
    }

    // Territory favorability: explicit map from territory-analysis wins; when
    // absent and a search is referenced, derive from the persisted
    // territory_stats (same pure rules the analysis ran).
    const favorByPlace = new Map<string, number>();
    for (const [pid, favor] of Object.entries(parsed.data.territoryFavorabilityByPlace ?? {})) {
      favorByPlace.set(pid, favor);
    }
    let territoryStats: TerritoryStats[] = [];
    let territoryInsights: ReturnType<typeof buildTerritoryInsights> = [];
    let territoryGroupBy: TerritoryGroupBy | null = null;
    if (favorByPlace.size === 0 && parsed.data.searchId) {
      const { data: trows } = await admin
        .from("territory_stats")
        .select("group_by, key, company_count, hot_count, avg_score, without_website_ratio")
        .eq("search_id", parsed.data.searchId)
        .limit(100);
      const rows = (trows ?? []) as Array<{
        group_by: TerritoryGroupBy;
        key: string;
        company_count: number;
        hot_count: number;
        avg_score: number;
        without_website_ratio: number;
      }>;
      if (rows.length > 0) {
        territoryGroupBy = rows[0].group_by;
        territoryStats = rows.map((t) => ({
          key: t.key,
          companyCount: t.company_count,
          hotCount: t.hot_count,
          avgScore: t.avg_score,
          withoutWebsite: Math.round(t.company_count * Number(t.without_website_ratio)),
          withoutWebsiteRatio: Number(t.without_website_ratio),
        }));
        territoryInsights = buildTerritoryInsights(territoryStats);
      }
    }

    let query = readClient
      .from("places")
      .select(
        "id, website_uri, national_phone_number, international_phone_number, primary_type, types, email, instagram, whatsapp, rating, user_rating_count, business_status, formatted_address, address_components, enrichment_sources, founded_at",
      )
      .in("id", placeIds);
    if (internal) query = query.eq("organization_id", organizationId);
    const { data: places } = await query;

    let updated = 0;
    for (const row of (places ?? []) as PlaceRowWithId[]) {
      const input = scoreInputFromRow(row, distanceByPlace.get(row.id) ?? null);

      // Territory favorability: explicit map first; persisted stats fallback
      // derives the SAME region key the analysis used (parseAddress + groupBy).
      let territoryFavorability: number | null = favorByPlace.get(row.id) ?? null;
      if (territoryFavorability == null && territoryGroupBy && territoryStats.length > 0) {
        const parts = parseAddress(row.formatted_address ?? null, row.address_components);
        const key = territoryKeyForCompany(parts.neighborhood, parts.city, territoryGroupBy);
        if (key) {
          territoryFavorability = territoryFavorabilityFor(territoryStats, territoryInsights, key);
        }
      }

      // Per-source states (V3-C): drive the score progression state + the
      // new checked-absence signals. Registry absent = on-demand, never
      // blocks FINALIZADO (deriveOpportunityScoreState handles it).
      const sources = (row.enrichment_sources as EnrichmentSourceMap | null) ?? {};
      const websiteState = sources.website?.status ?? null;
      const registryState = sources.business_registry?.status ?? null;

      const signalCtx: SignalContext = {
        hasWebsite: input.hasWebsite,
        hasValidPhone: input.hasValidPhone,
        whatsappStatus: input.whatsappStatus,
        hasEmail: input.hasEmail,
        rating: input.rating,
        reviewCount: input.reviewCount,
        businessStatus: input.businessStatus,
        instagramFollowers: null,
        isNewBusiness: null,
        localDensity: null,
        lowDigitalCompetition: null,
        territoryFavorability,
        // Checked absence (V3-C): website source finished and found no
        // Instagram — a VERIFIED absence, distinct from "not checked yet".
        instagramAbsentAfterCheck:
          (websiteState === "enriched" || websiteState === "partial") && !row.instagram,
        websiteSourceFailed: websiteState === "failed" && input.hasWebsite,
        // V3-D second ESTABLISHED trigger: real registry age (never invented).
        yearsInBusiness: yearsInBusiness(row.founded_at ?? null),
      };
      const signals = deriveSignals(signalCtx);
      const signalEvidence = buildSignalEvidence(signals, signalCtx);

      const placeMission = mission ?? missionByPlace.get(row.id) ?? null;
      const intentMatch = intentMatchForCompany(placeMission, {
        primaryType: row.primary_type ?? null,
        types: row.types ?? [],
        hasWebsite: input.hasWebsite,
        distanceMeters: distanceByPlace.get(row.id) ?? null,
      });

      const opp = calculateOpportunityScore({
        signals,
        rating: input.rating,
        reviewCount: input.reviewCount,
        hasWebsite: input.hasWebsite,
        whatsappStatus: input.whatsappStatus,
        intentMatch,
        territoryFavorability,
        freshnessDays: null,
        websiteState,
        registryState,
      });

      const { error } = await admin.from("company_opportunity_scores").upsert(
        {
          organization_id: organizationId,
          place_id: row.id,
          search_id: parsed.data.searchId ?? null,
          score: opp.total,
          temperature: opportunityTemperatureFromScore(opp.total),
          rule_version: OPPORTUNITY_SCORE_VERSION,
          breakdown: opp,
          signals: signalEvidence,
          confidence: opp.confidence,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,place_id,rule_version" },
      );
      if (!error) updated++;

      // Fase 3 (unificação de score): leads.score = V2 — o MESMO número em
      // descoberta, detalhe, kanban e painel. Este é o ESCRITOR ÚNICO do V2
      // em leads; a cópia materializada preserva o contrato de filtro/ordem
      // do cliente (filters.ts). O v3 anterior permanece em score_legacy_v3
      // (gravado pela migration/import) para rollback — nunca é sobrescrito
      // por null.
      await admin
        .from("leads")
        .update({
          score: opp.total,
          score_rule_version: OPPORTUNITY_SCORE_VERSION,
          temperature: opportunityTemperatureFromScore(opp.total),
        })
        .eq("organization_id", organizationId)
        .eq("place_id", row.id);

      // Provenance (spec #26): the Google discovery data behind this score,
      // recorded once per place/provider — never duplicated on re-scores.
      const { data: existingSource } = await admin
        .from("company_sources")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("place_id", row.id)
        .eq("provider", "google_places")
        .maybeSingle();
      if (!existingSource) {
        await admin
          .from("company_sources")
          .insert({
            organization_id: organizationId,
            place_id: row.id,
            provider: "google_places",
            provider_external_id: null,
            source_type: "discovery",
            fetched_at: new Date().toISOString(),
            confidence: 1,
          })
          .select("id")
          .maybeSingle();
      }

      // Discovery contract: search_results carries the V2 result so the RPC
      // get_search_discovery (unchanged) serves the single display source.
      if (parsed.data.searchId) {
        await admin.from("search_results").upsert(
          {
            search_id: parsed.data.searchId,
            place_id: row.id,
            score: opp.total,
            temperature: opportunityTemperatureFromScore(opp.total),
            score_breakdown: opp,
          },
          { onConflict: "search_id,place_id" },
        );
      }
    }

    logEvent({
      requestId,
      organizationId,
      operation: "score-company",
      status: "ok",
      resultCount: updated,
      hasMission: mission != null || missionByPlace.size > 0,
    });
    if (jobId) {
      await stampJobMetrics(admin, jobId, {
        // Scoring é computação local sobre dados já persistidos — nenhuma
        // chamada paga de provider: zero COMPROVADO ('measured').
        realCostUsd: 0,
        estimatedCostUsd: 0,
        costSource: "measured",
      });
      await jobQueue.complete(jobId, { updated, ruleVersion: OPPORTUNITY_SCORE_VERSION });
    }
    return json({ updated, ruleVersion: OPPORTUNITY_SCORE_VERSION }, 200, {}, req);
  } catch (err) {
    // Worker path: close the claimed job with honest retry classification.
    // Known-permanent AppErrors (validation/not-found) fail permanently;
    // unexpected errors go through classifyRetryableError (bounded retries).
    if (jobId) {
      const jobQueue = createSupabaseJobQueue(adminClient());
      await stampJobMetrics(adminClient(), jobId, {
        realCostUsd: 0,
        estimatedCostUsd: 0,
        costSource: "measured",
      }).catch(() => {});
      await jobQueue
        .fail(
          jobId,
          err instanceof AppError ? { status: 422, message: err.message, name: err.code } : err,
        )
        .catch(() => {}); // never let job-closing mask the original error
    }
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
