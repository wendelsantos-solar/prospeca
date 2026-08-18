// enrich-discovery: fills contact signals (email/instagram/whatsapp) on the
// PLACES of a search's discovery results, by scraping each business's OWN
// website (SSRF-guarded, timed out) — then re-scores the affected search_results
// rows with the v3.0.0 rule. Enrichment is business-level and cached on the
// place (enriched_at), so re-searches reuse it. Additive: never nulls a column.
//
// Modes:
//   - Authenticated (frontend): { searchId } → top-10 by score with a website,
//     not recently enriched. { searchId, placeId } → just that place (on-open).
//   - Internal (service-role): fired by the process-jobs worker for a claimed
//     BUSINESS_DATA_ENRICHMENT job. `organizationId` comes from the body and is
//     validated against the referenced search; `jobId` is the claimed job this
//     pass closes (completed/retrying/failed via the queue classification).
//
// The per-place pass lives in ../_shared/enrich-company.ts, shared by both
// paths so interactive and worker runs behave identically.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import { isEnrichmentSourceStale, type EnrichmentSourceMap } from "@leads/domain/enrichment-state";
import { enrichOnePlace, ENRICHMENT_STALE_DAYS } from "../_shared/enrich-company.ts";
import { createSupabaseJobQueue } from "../_shared/job-queue.ts";
import { recordUsage } from "../_shared/quota.ts";
import { calculateUsageCost } from "@leads/domain/cost-model";

const InputSchema = z
  .object({
    searchId: z.string().uuid(),
    placeId: z.string().uuid().optional(),
    /** Internal (service-role) calls only — validated against the search. */
    organizationId: z.string().uuid().optional(),
    /** Worker path: the claimed BUSINESS_DATA_ENRICHMENT job to close. */
    jobId: z.string().uuid().optional(),
  })
  .refine((v) => v.organizationId || !v.jobId, {
    message: "jobId exige organização (chamada interna).",
  })
  .refine((v) => !v.jobId || v.placeId, {
    message: "jobId exige placeId (o worker processa exatamente o place do job).",
  });

// Batch enrichment runs on the top-N scored places with a website that haven't
// been enriched recently. Reduced from 25→10: each site fetch takes up to 4s
// and runs at concurrency 5, so 25 places worst-case was 20s. At 10, worst-case
// is 8s and the top-scoring results (what users see first) are still covered.
// Individual on-open enrichment (single placeId) is unaffected — it always runs
// immediately for the place the user clicked.
const TOP_N = 10;
const CONCURRENCY = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { searchId } = parsed.data;
    const placeId = parsed.data.placeId ?? null;

    const internal = await isInternalCall(req);
    let organizationId: string;
    let actorUserId: string | undefined;
    if (internal) {
      organizationId = parsed.data.organizationId ?? "";
      if (!organizationId) {
        throw new AppError("VALIDATION_ERROR", "organizationId obrigatório (chamada interna).");
      }
    } else {
      const ctx = await requireAuth(req);
      organizationId = ctx.organizationId;
      actorUserId = ctx.userId;
      await assertRateLimit(ctx.adminClient, ctx.organizationId, "enrich_request", 20);
    }

    const admin = adminClient();

    // Search must belong to the caller's org (authenticated) / the body's org
    // (internal) — the same tenant proof pattern as score-company.
    const { data: search } = await admin
      .from("searches")
      .select("id, organization_id")
      .eq("id", searchId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");

    const staleBefore = new Date(Date.now() - ENRICHMENT_STALE_DAYS * 86400000).toISOString();

    let query = admin
      .from("search_results")
      .select("place_id, distance_meters, score, places(*)")
      .eq("search_id", searchId)
      .order("score", { ascending: false });
    if (placeId) query = query.eq("place_id", placeId);

    const { data: rows } = await query;
    type Row = {
      place_id: string;
      distance_meters: number | null;
      score: number | null;
      // supabase returns the joined row as an object (single FK)
      places: Record<string, unknown> | null;
    };
    // Worker path: the claimed job targets ONE place — process it UNFILTERED
    // (the job was enqueued for a reason; staleness is the enqueuer's decision,
    // not the handler's). Interactive paths keep the freshness filter, which
    // now reads the per-source TTL (enrichment_sources.website.expiresAt)
    // with the legacy enriched_at as fallback for old rows.
    const candidates = ((rows ?? []) as unknown as Row[])
      .filter((r) => {
        if (!r.places) return false;
        if (internal) return true;
        const website = r.places.website_uri as string | null;
        if (!website) return false;
        const sources = (r.places.enrichment_sources as EnrichmentSourceMap | null) ?? null;
        if (sources && !isEnrichmentSourceStale(sources, "website")) return false; // fresh
        const enrichedAt = r.places.enriched_at as string | null;
        return enrichedAt == null || enrichedAt < staleBefore;
      })
      .slice(0, internal ? 1 : placeId ? 1 : TOP_N);

    // A worker job whose place is not in this search's results is a payload
    // mismatch — fail it permanently (visible in the admin DLQ) instead of
    // leaving it processing forever.
    if (internal && parsed.data.jobId && candidates.length === 0) {
      const queue = createSupabaseJobQueue(admin);
      await queue.fail(parsed.data.jobId, {
        status: 422,
        message: "place do job não pertence à busca",
      });
      return json({ enriched: 0, status: "ok", jobFailed: true }, 200, {}, req);
    }
    const results = await mapWithConcurrency(
      candidates,
      internal && parsed.data.jobId ? 1 : CONCURRENCY,
      (r) =>
        enrichOnePlace({
          admin,
          organizationId,
          searchId,
          placeId: r.place_id,
          jobId: internal ? (parsed.data.jobId ?? null) : null,
          place: (r.places ?? {}) as Record<string, unknown>,
          distanceMeters: r.distance_meters,
        }),
    );

    // Fase 7: o contador do rate limit (assertRateLimit acima) só existe se
    // alguém GRAVA o mesmo event_type — recordUsage aqui fecha o ciclo
    // (referência: create-export). Custo: scrape de site próprio = infra
    // própria, zero COMPROVADO ('measured').
    const cost = calculateUsageCost("website_scraper", "enrich_request", results.length);
    await recordUsage(admin, {
      organizationId,
      userId: actorUserId,
      eventType: "enrich_request",
      provider: "website_scraper",
      quantity: Math.max(1, results.length),
      estimatedCostUsd: cost.estimatedCostUsd,
      realCostUsd: cost.realCostUsd,
      costSource: cost.source,
      metadata: { searchId, internal },
    });

    logEvent({
      requestId,
      searchId,
      organizationId,
      operation: "enrich-discovery",
      status: "ok",
      resultCount: results.length,
      internal,
    });
    return json({ enriched: results.length, status: "ok" }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "enrich-discovery", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
