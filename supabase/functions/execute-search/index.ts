// execute-search: internal worker. Calls Google Places (Text Search),
// paginates within limits, upserts places, links search_results,
// validates distance with PostGIS, updates progress. Service-role only.
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { recordUsage } from "../_shared/quota.ts";
import { captureError } from "../_shared/error-tracking.ts";
import { textSearch, type GooglePlace } from "../_shared/google.ts";
import { categoryKey, placesCacheKey } from "@leads/domain/cache";
import { shouldForceRefresh } from "../_shared/refresh.ts";
import { fireAndForget } from "../_shared/dispatch.ts";
import { createSupabaseJobQueue } from "../_shared/job-queue.ts";
import { companyProcessingKey } from "@leads/domain/job";
import { readPoint } from "@leads/geo";
import { selectPlaces, buildResultRows } from "../_shared/search-pipeline.ts";

const ABSOLUTE_MAX_PAGES = 3; // hard technical cap per execution

/** Enqueue one OPPORTUNITY_SCORING job per place (tenant-scoped idempotency
 * key) and wake the worker ONCE. Returns how many jobs were enqueued. */
async function enqueueScoringJobs(
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  searchId: string,
  placeIds: string[],
): Promise<number> {
  if (placeIds.length === 0) return 0;
  const queue = createSupabaseJobQueue(admin);
  await Promise.all(
    placeIds.map((placeId) =>
      queue.enqueue({
        type: "OPPORTUNITY_SCORING",
        organizationId,
        searchId,
        companyId: placeId,
        idempotencyKey: companyProcessingKey(organizationId, searchId, placeId),
        payload: { searchId, placeId },
      }),
    ),
  );
  fireAndForget("process-jobs", {}); // single wake — the worker drains the queue
  return placeIds.length;
}

/** Enqueue ONE TERRITORY_ANALYSIS job per search (spec #37–41). The scoring
 * enqueue above already woke the worker; a dedicated wake is unnecessary. */
async function enqueueTerritoryAnalysis(
  admin: ReturnType<typeof adminClient>,
  organizationId: string,
  searchId: string,
): Promise<void> {
  const queue = createSupabaseJobQueue(admin);
  await queue.enqueue({
    type: "TERRITORY_ANALYSIS",
    organizationId,
    searchId,
    idempotencyKey: `territory-analysis:${organizationId}:${searchId}`,
    payload: { searchId },
  });
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  const startedAt = Date.now();

  if (!(await isInternalCall(req))) {
    return new AppError("FORBIDDEN", "Função interna.").toResponse(requestId, req);
  }

  const admin = adminClient();
  let searchId: string | null = null;

  try {
    const body = await req.json();
    searchId = body.searchId as string;
    const forceRefresh = body.forceRefresh === true;
    if (!searchId) throw new AppError("VALIDATION_ERROR", "searchId obrigatório.");

    const { data: search } = await admin
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");
    if (!["queued", "searching"].includes(search.status)) {
      return json({ searchId, status: search.status, skipped: true }, 200, {}, req);
    }

    await admin
      .from("searches")
      .update({ status: "searching", started_at: new Date().toISOString() })
      .eq("id", searchId);

    // Cache de nível-busca (Fase 3): se há uma busca gêmea recente da org, reusa
    // os search_results dela — zero Google, zero re-import, quase instantâneo.
    // forceRefresh ignora (usuário quer dado fresco).
    if (!forceRefresh) {
      const { data: reused } = await admin.rpc("reuse_recent_search_results", {
        p_search_id: searchId,
      });
      if (typeof reused === "number" && reused > 0) {
        // V2: score the (copied) places async — per-company jobs, idempotent,
        // drained by the process-jobs worker (non-blocking).
        const { data: reusedRows } = await admin
          .from("search_results")
          .select("place_id")
          .eq("search_id", searchId);
        await enqueueScoringJobs(
          admin,
          search.organization_id as string,
          searchId,
          (reusedRows ?? []).map((r) => r.place_id as string),
        );
        await enqueueTerritoryAnalysis(admin, search.organization_id as string, searchId);
        logEvent({
          requestId,
          searchId,
          organizationId: search.organization_id,
          provider: "google_places",
          operation: "execute-search",
          durationMs: Date.now() - startedAt,
          status: "completed",
          requestCount: 0,
          cacheHit: true,
          resultCount: reused,
        });
        return json({ searchId, status: "completed", found: reused, reused: true }, 200, {}, req);
      }
    }

    // PostgREST returns geography(point) as hex EWKB, not GeoJSON — decode it.
    const center = readPoint(search.center);
    if (!center) throw new AppError("INVALID_LOCATION", "Centro da busca inválido.");
    const [centerLng, centerLat] = center;

    const maxResults: number = search.max_results ?? 60;
    // Taxonomy-resolved search (GAP #5): use the CANONICAL category persisted by
    // create-search, and pass the primary Google Places type to the provider as
    // includedType (restricts results server-side). Unresolved searches keep the
    // legacy raw concatenation (or query alone).
    const canonicalCategory = (search.canonical_category as string | null) ?? null;
    const placesTypes = ((search.places_types as string[] | null) ?? []) as string[];
    const textQuery = canonicalCategory ?? search.category
      ? `${search.query} ${canonicalCategory ?? search.category}`
      : search.query;
    const includedType = placesTypes.length > 0 ? placesTypes[0] : undefined;
    let requestCount = 0;
    let collected: GooglePlace[] = [];

    // Cache: skip the paid Google call when an equivalent recent search exists
    // (region+category bucketed at ~110m precision, cross-tenant). Payload holds
    // only public business data. TTL (30d, ToS limit) enforced via expires_at.
    const categorySlug = categoryKey(textQuery);
    const cacheKey = placesCacheKey({
      provider: "google_places",
      category: textQuery,
      latitude: centerLat,
      longitude: centerLng,
      radiusMeters: search.radius_meters,
    });

    // Force refresh bypasses cache reads and re-pays Google, but a per-search
    // cooldown (keyed by cache_key) blocks accidental cost loops (D7): if this
    // key was force-fetched within the window, fall back to normal cached serve.
    let doForce = false;
    if (forceRefresh) {
      const { data: existing } = await admin
        .from("provider_search_cache")
        .select("last_forced_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      const lastForcedMs = existing?.last_forced_at
        ? new Date(existing.last_forced_at as string).getTime()
        : null;
      doForce = shouldForceRefresh(true, lastForcedMs, Date.now());
    }

    let servedFromCache = false;
    if (!doForce) {
      // Fast path: exact key match (~110m bucket). Cheap, serves identical repeats.
      const { data: cachedRow } = await admin
        .from("provider_search_cache")
        .select("payload, hit_count")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cachedRow?.payload) {
        collected = cachedRow.payload as GooglePlace[];
        requestCount = 0;
        servedFromCache = true;
        await admin
          .from("provider_search_cache")
          .update({ hit_count: (cachedRow.hit_count ?? 0) + 1 })
          .eq("cache_key", cacheKey);
      } else {
        // Coverage path (Nivel 2): a larger cached circle that geometrically
        // contains this one can serve it — filter its payload by haversine to
        // the requested circle. Geometrically correct reuse across centers/radii.
        const { data: coverData } = await admin
          .rpc("find_covering_cache", {
            p_category: categorySlug,
            p_lng: centerLng,
            p_lat: centerLat,
            p_radius: search.radius_meters,
          })
          .maybeSingle();
        const cover = coverData as { payload: GooglePlace[]; radius_meters: number } | null;

        if (cover?.payload) {
          collected = cover.payload.filter((p) => {
            const lat = p.location?.latitude ?? null;
            const lng = p.location?.longitude ?? null;
            // No coordinate -> cannot prove it's outside; keep (matches the fine
            // radius cut below, which also lets coord-less places through).
            if (lat == null || lng == null) return true;
            return haversineMeters(centerLat, centerLng, lat, lng) <= search.radius_meters;
          });
          requestCount = 0;
          servedFromCache = true;
          // No upsert: this circle is already covered by the larger cached entry.
        }
      }
    }

    if (servedFromCache) {
      await admin
        .from("searches")
        .update({ provider_request_count: 0, found_count: collected.length })
        .eq("id", searchId);
    } else {
      // Guarda-corpo de budget (Fase 1): se a org definiu um teto mensal e o
      // gasto estimado do mês já estourou, NÃO paga o Google — a busca completa
      // com o que o cache deu (aqui, nada) e é marcada budget_capped p/ a UI
      // avisar. Opt-in: budget nulo = ilimitado, guarda-corpo inerte.
      let budgetCapped = false;
      const { data: org } = await admin
        .from("organizations")
        .select("monthly_api_budget_usd")
        .eq("id", search.organization_id)
        .maybeSingle();
      const budget = org?.monthly_api_budget_usd;
      if (budget != null) {
        const { data: mtd } = await admin.rpc("org_mtd_api_cost_usd", {
          p_organization_id: search.organization_id,
        });
        if (typeof mtd === "number" && mtd >= Number(budget)) budgetCapped = true;
      }

      if (budgetCapped) {
        await admin.from("searches").update({ budget_capped: true }).eq("id", searchId);
      } else {
        // Miss (or forced): pay Google, then overwrite the cache under the exact
        // key with the coverage columns + a renewed 30d TTL. On a forced fetch,
        // stamp last_forced_at and log the paid refresh for per-org usage tracking.
        let pageToken: string | undefined;
        for (let page = 0; page < ABSOLUTE_MAX_PAGES; page++) {
          const res = await textSearch({
            textQuery,
            latitude: centerLat,
            longitude: centerLng,
            radiusMeters: search.radius_meters,
            pageToken,
            includedType,
          });
          requestCount++;
          await recordUsage(admin, {
            organizationId: search.organization_id,
            eventType: "place_search_request",
            provider: "google_places",
            quantity: 1,
            metadata: { searchId, page, forced: doForce },
          });
          collected = collected.concat(res.places);
          await admin
            .from("searches")
            .update({ provider_request_count: requestCount, found_count: collected.length })
            .eq("id", searchId);
          if (!res.nextPageToken || collected.length >= maxResults) break;
          pageToken = res.nextPageToken;
        }

        const cacheRow: Record<string, unknown> = {
          cache_key: cacheKey,
          organization_id: search.organization_id,
          provider: "google_places",
          payload: collected,
          result_count: collected.length,
          category: categorySlug,
          center: `POINT(${centerLng} ${centerLat})`,
          radius_meters: search.radius_meters,
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
        };
        if (doForce) {
          cacheRow.last_forced_at = new Date().toISOString();
          await recordUsage(admin, {
            organizationId: search.organization_id,
            eventType: "place_search_refresh",
            provider: "google_places",
            quantity: 1,
            metadata: { searchId },
          });
        }
        await admin.from("provider_search_cache").upsert(cacheRow, { onConflict: "cache_key" });
      }
    }

    // Taxonomy type refinement: when the taxonomy resolved, keep only places
    // whose Google `types` intersect the taxonomy's places_types. Lenient: a
    // place without type data is kept (coverage-cache payloads may lack it).
    if (placesTypes.length > 0) {
      collected = collected.filter((p) => {
        const types = p.types ?? [];
        return types.length === 0 || types.some((t) => placesTypes.includes(t));
      });
    }

    collected = collected.slice(0, maxResults);
    const providerName = "google_places";

    // Cancelled mid-flight?
    const { data: fresh } = await admin
      .from("searches")
      .select("status")
      .eq("id", searchId)
      .single();
    if (fresh?.status === "cancelled") return json({ searchId, status: "cancelled" }, 200, {}, req);

    await admin.from("searches").update({ status: "importing" }).eq("id", searchId);

    // ── Pipeline: filter, dedupe, score places (pure, extracted to search-pipeline.ts) ──
    const { placeRows, resultMeta } = selectPlaces({
      collected,
      organizationId: search.organization_id,
      providerName,
      center: { latitude: centerLat, longitude: centerLng },
      radiusMeters: search.radius_meters,
      presenceFilter: search.presence_filter,
      now: new Date().toISOString(),
      refreshAfter: new Date(Date.now() + 30 * 86400_000).toISOString(),
    });
    const insideCount = resultMeta.filter((m) => m.inside).length;

    // ── Upsert places in batch → map provider_place_id → id. ──
    const idByProviderPlaceId = new Map<string, string>();
    if (placeRows.length > 0) {
      const { data: upserted, error: upsertError } = await admin
        .from("places")
        .upsert(placeRows, { onConflict: "organization_id,provider,provider_place_id" })
        .select("id, provider_place_id");
      if (!upsertError && upserted) {
        for (const row of upserted) {
          idByProviderPlaceId.set(row.provider_place_id as string, row.id as string);
        }
      }
    }

    // ── Build & upsert search_results in batch. ──
    const resultRows = buildResultRows(resultMeta, idByProviderPlaceId, searchId, search.query);
    if (resultRows.length > 0) {
      await admin.from("search_results").upsert(resultRows, { onConflict: "search_id,place_id" });
    }

    await admin
      .from("searches")
      .update({
        status: "completed",
        found_count: collected.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", searchId);

    // V2: score the discovered places async — per-company OPPORTUNITY_SCORING
    // jobs, idempotent (unique key), drained by the process-jobs worker.
    // The frontend reads company_opportunity_scores via RLS and falls back to
    // client-side calculation until the scores land. TERRITORY_ANALYSIS is
    // enqueued as a per-search job and feeds favorability back into the score.
    const discoveredPlaceIds = [...idByProviderPlaceId.values()];
    await enqueueScoringJobs(admin, search.organization_id as string, searchId, discoveredPlaceIds);
    if (discoveredPlaceIds.length > 0) {
      await enqueueTerritoryAnalysis(admin, search.organization_id as string, searchId);
    }

    // Descoberta NÃO materializa leads. O funil é povoado por ação explícita
    // do usuário (+Funil / WhatsApp / disparo em massa), via import-search-results.

    logEvent({
      requestId,
      searchId,
      organizationId: search.organization_id,
      provider: "google_places",
      operation: "execute-search",
      durationMs: Date.now() - startedAt,
      status: "completed",
      requestCount,
      cacheHit: requestCount === 0,
      resultCount: collected.length,
      insideRadius: insideCount,
    });
    return json({ searchId, status: "completed", found: collected.length }, 200, {}, req);
  } catch (err) {
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
    const errorMessage =
      err instanceof AppError ? err.message : "Erro interno. Tente novamente em instantes.";

    // Track unexpected errors for production observability.
    if (code === "INTERNAL_ERROR") {
      captureError(err, {
        location: "execute-search",
        requestId,
        // `extra` is the field ErrorContext exposes; `context` was silently dropped.
        extra: { searchId, code },
      });
    }

    if (searchId) {
      // Partial results survive: mark partial when anything was linked.
      const { count } = await admin
        .from("search_results")
        .select("id", { count: "exact", head: true })
        .eq("search_id", searchId);
      await admin
        .from("searches")
        .update({
          status: (count ?? 0) > 0 ? "partial" : "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", searchId);
    }
    logEvent({
      requestId,
      searchId,
      operation: "execute-search",
      status: "error",
      errorCode: code,
    });
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
