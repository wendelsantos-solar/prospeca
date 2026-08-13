// enrich-discovery: fills contact signals (email/instagram/whatsapp) on the
// PLACES of a search's discovery results, by scraping each business's OWN
// website (SSRF-guarded, timed out) — then re-scores the affected search_results
// rows with the v2.0.0 rule. Enrichment is business-level and cached on the
// place (enriched_at), so re-searches reuse it. Additive: never nulls a column.
//
// Modes: { searchId } → top-25 by score with a website, not recently enriched.
//        { searchId, placeId } → just that place (on-open, lazy).
//
// NOT runtime-verified in this checkout (no Deno/Supabase CLI here). Uses the
// same _shared helpers as enrich-lead.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import { enrichFromWebsite } from "../_shared/enrich.ts";
import { calculateScore, temperatureFromScore } from "@leads/domain/score";
import { scoreInputFromRow, type PlaceRow } from "@leads/domain/score-input";
import {
  deriveEnrichmentState,
  buildFieldMap,
  type EnrichmentFieldMap,
  type EnrichmentFieldName,
} from "@leads/domain/enrichment-state";
import { companyProcessingKey } from "@leads/domain/job";

const InputSchema = z.union([
  z.object({ searchId: z.string().uuid() }),
  z.object({ searchId: z.string().uuid(), placeId: z.string().uuid() }),
]);

// Batch enrichment runs on the top-N scored places with a website that haven't
// been enriched recently. Reduced from 25→10: each site fetch takes up to 4s
// and runs at concurrency 5, so 25 places worst-case was 20s. At 10, worst-case
// is 8s and the top-scoring results (what users see first) are still covered.
// Individual on-open enrichment (single placeId) is unaffected — it always runs
// immediately for the place the user clicked.
const TOP_N = 10;
const CONCURRENCY = 5;
const SITE_TIMEOUT_MS = 4000;
const STALE_DAYS = 30;

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
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { searchId } = parsed.data;
    const placeId = "placeId" in parsed.data ? parsed.data.placeId : null;

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "enrich_request", 20);

    // Search must belong to the caller's org.
    const { data: search } = await ctx.adminClient
      .from("searches")
      .select("id, organization_id")
      .eq("id", searchId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");

    const staleBefore = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();

    let query = ctx.adminClient
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
    const candidates = ((rows ?? []) as unknown as Row[])
      .filter((r) => {
        const p = r.places;
        if (!p) return false;
        const website = p.website_uri as string | null;
        if (!website) return false;
        const enrichedAt = p.enriched_at as string | null;
        return enrichedAt == null || enrichedAt < staleBefore;
      })
      .slice(0, placeId ? 1 : TOP_N);

    const results = await mapWithConcurrency(candidates, CONCURRENCY, async (r) => {
      const p = r.places as Record<string, unknown>;

      // Record a job row so the async enrichment is observable/retryable
      // (spec #17). Idempotency key = one row per company-processing pass.
      const jobId = crypto.randomUUID();
      await ctx.adminClient.from("jobs").insert({
        id: jobId,
        organization_id: ctx.organizationId,
        type: "BUSINESS_DATA_ENRICHMENT",
        search_id: searchId,
        place_id: r.place_id,
        status: "processing",
        attempt: 1,
        payload: { website: p.website_uri as string | null },
        idempotency_key: companyProcessingKey(ctx.organizationId, searchId, r.place_id),
        started_at: new Date().toISOString(),
      });

      // Mark in-flight before the slow scrape so a mid-flight crash leaves a
      // recoverable "processing" state, not a misleading "pending".
      await ctx.adminClient
        .from("places")
        .update({ enrichment_state: "processing" })
        .eq("id", r.place_id);

      // One retry on transient provider errors (timeout / 5xx). Definitive
      // "not_found"/"blocked" are not retried.
      let outcome = await enrichFromWebsite({
        website: p.website_uri as string,
        timeoutMs: SITE_TIMEOUT_MS,
      });
      if (outcome.status === "error") {
        await new Promise((res) => setTimeout(res, 400));
        const second = await enrichFromWebsite({
          website: p.website_uri as string,
          timeoutMs: SITE_TIMEOUT_MS,
        });
        if (second.status !== "error") outcome = second;
      }

      const { fields, outcomes } = outcome;

      const found: Record<string, string> = {};
      for (const f of fields) {
        if (f.field === "email" && !found.email) found.email = f.value;
        if (f.field === "instagram" && !found.instagram) found.instagram = f.value;
        if (f.field === "whatsapp" && !found.whatsapp) found.whatsapp = f.value;
      }

      // Per-field state (email/instagram/whatsapp — phone stays Google-
      // authoritative). A transient error / SSRF block marks the fields
      // `failed`; a successful fetch marks them `complete` with their `has`.
      const TARGET_FIELDS: EnrichmentFieldName[] = ["email", "instagram", "whatsapp"];
      const fieldMap: EnrichmentFieldMap =
        outcome.status === "error" || outcome.status === "blocked"
          ? buildFieldMap([], TARGET_FIELDS)
          : buildFieldMap(
              outcomes
                .filter((o) => o.status === "complete" && o.field !== "phone")
                .map((o) => ({ field: o.field as EnrichmentFieldName, has: o.has })),
              [],
            );
      const enrichmentState = deriveEnrichmentState(fieldMap);

      // Additive: only fill columns currently empty; always stamp the state.
      const patch: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
        enrichment_status: outcome.status, // legacy free-text column, kept in sync
        enrichment_state: enrichmentState,
        enrichment_fields: fieldMap,
      };
      if (found.email && !p.email) patch.email = found.email;
      if (found.instagram && !p.instagram) patch.instagram = found.instagram;
      if (found.whatsapp && !p.whatsapp) {
        patch.whatsapp = found.whatsapp;
        patch.whatsapp_status = "verified";
      }
      await ctx.adminClient.from("places").update(patch).eq("id", r.place_id);

      // Re-score with the merged (post-patch) place state.
      const merged = { ...p, ...patch } as PlaceRow;
      const bd = calculateScore(scoreInputFromRow(merged, r.distance_meters));
      await ctx.adminClient
        .from("search_results")
        .update({
          score: bd.total,
          temperature: temperatureFromScore(bd.total),
          score_breakdown: bd,
        })
        .eq("search_id", searchId)
        .eq("place_id", r.place_id);

      // Close the job: a definitive answer (ok/not_found/blocked) → completed;
      // a transient fetch failure → failed (dead-letter after max attempts).
      await ctx.adminClient
        .from("jobs")
        .update({
          status: outcome.status === "error" ? "failed" : "completed",
          result: { fieldsFound: Object.keys(found).length, enrichmentStatus: outcome.status },
          error: outcome.status === "error" ? "website fetch failed" : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { placeId: r.place_id, found: Object.keys(found).length, status: outcome.status };
    });

    logEvent({
      requestId,
      searchId,
      organizationId: ctx.organizationId,
      operation: "enrich-discovery",
      status: "ok",
      resultCount: results.length,
    });
    return json({ enriched: results.length, status: "ok" }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "enrich-discovery", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
