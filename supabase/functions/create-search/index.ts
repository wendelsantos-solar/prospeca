// create-search: validates input, checks quota, geocodes if needed,
// creates the search row and triggers async execution.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, assertSearchQuota, recordUsage, writeAudit } from "../_shared/quota.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
import { geocode } from "../_shared/google.ts";
import { readPoint } from "../_shared/geo.ts";

const InputSchema = z.object({
  query: z.string().min(2).max(120),
  category: z.string().max(80).optional(),
  location: z.object({
    label: z.string().min(2).max(200),
    placeId: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  radiusMeters: z.number().int().min(100).max(100000),
  presenceFilter: z.enum(["without_website", "with_website", "all"]),
  maxResults: z.number().int().min(1).max(500).optional(),
  // Force refresh: bypass the cache and re-fetch from Google (paid). Guarded by
  // a per-search cooldown in execute-search. Default false.
  forceRefresh: z.boolean().optional(),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  const startedAt = Date.now();

  try {
    const ctx = await requireAuth(req);
    const raw = await req.json();
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Dados de busca inválidos.", {
        issues: parsed.error.issues,
      });
    }
    const input = parsed.data;

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "search_request", 5);
    await assertSearchQuota(ctx.adminClient, ctx.organizationId);

    const idempotencyKey = req.headers.get("x-idempotency-key");

    const result = await withIdempotency(
      ctx.adminClient,
      ctx.organizationId,
      idempotencyKey,
      "create-search",
      async () => {
        let { latitude, longitude } = input.location;

        if (latitude == null || longitude == null) {
          // Geocode cache first — avoid paying for repeated labels.
          const normalized = input.location.label.trim().toLowerCase();
          const { data: cached } = await ctx.adminClient
            .from("geocode_cache")
            .select("location")
            .eq("query_normalized", normalized)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();

          const cachedPoint = cached?.location ? readPoint(cached.location) : null;
          if (cachedPoint) {
            [longitude, latitude] = cachedPoint;
          } else {
            const geo = await geocode(input.location.label);
            if (!geo) throw new AppError("INVALID_LOCATION", "Localização não encontrada.");
            latitude = geo.latitude;
            longitude = geo.longitude;
            await recordUsage(ctx.adminClient, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              eventType: "geocode_request",
              provider: "google_geocoding",
            });
            await ctx.adminClient.from("geocode_cache").upsert(
              {
                query_normalized: normalized,
                label: geo.label,
                location: `POINT(${longitude} ${latitude})`,
              },
              { onConflict: "query_normalized" },
            );
          }
        }

        const { data: search, error } = await ctx.adminClient
          .from("searches")
          .insert({
            organization_id: ctx.organizationId,
            created_by: ctx.userId,
            query: input.query,
            category: input.category ?? null,
            location_label: input.location.label,
            center: `POINT(${longitude} ${latitude})`,
            radius_meters: input.radiusMeters,
            presence_filter: input.presenceFilter,
            status: "queued",
            provider: "google_places",
            // Google Text Search bills per page (pageSize 20, 3 pages = 60).
            // Cap at 60; override with SEARCH_MAX_RESULTS.
            max_results: (() => {
              const cap = Number(Deno.env.get("SEARCH_MAX_RESULTS") ?? 60);
              return Math.min(input.maxResults ?? cap, cap);
            })(),
          })
          .select("id, status")
          .single();
        if (error || !search) throw new AppError("INTERNAL_ERROR", "Falha ao criar busca.");

        await recordUsage(ctx.adminClient, {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          eventType: "search_request",
          metadata: { searchId: search.id },
        });
        await writeAudit(ctx.adminClient, {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          action: "search.created",
          entityType: "search",
          entityId: search.id,
          metadata: { query: input.query, radiusMeters: input.radiusMeters },
        });

        // Dispatch async execution via execute-search. A bare fire-and-forget
        // fetch can be dropped when this function returns before the request is
        // sent — the biggest cause of searches stuck in 'queued'. EdgeRuntime.
        // waitUntil keeps the runtime alive so the trigger is actually sent, and
        // a few retries absorb transient network blips. The recover-stuck-searches
        // sweeper is the backstop for anything that still slips through.
        const triggerBody = JSON.stringify({
          searchId: search.id,
          forceRefresh: input.forceRefresh === true,
        });
        const dispatch = (async () => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-search`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: triggerBody,
              });
              return; // reached execute-search; it owns the rest (idempotent on re-entry)
            } catch {
              await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            }
          }
        })();
        const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
          .EdgeRuntime;
        if (edge?.waitUntil) edge.waitUntil(dispatch);
        else void dispatch;

        return { searchId: search.id, status: "queued" };
      },
    );

    logEvent({
      requestId,
      operation: "create-search",
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      durationMs: Date.now() - startedAt,
      status: "ok",
    });
    return json(result, 201);
  } catch (err) {
    if (err instanceof AppError) {
      logEvent({ requestId, operation: "create-search", status: "error", errorCode: err.code });
      return err.toResponse(requestId);
    }
    logEvent({
      requestId,
      operation: "create-search",
      status: "error",
      errorCode: "INTERNAL_ERROR",
    });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId);
  }
});
