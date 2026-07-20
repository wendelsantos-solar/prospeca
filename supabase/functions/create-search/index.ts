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
  maxResults: z.number().int().min(1).max(60).optional(),
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
            // Strangler: OSM (Nominatim) when enabled; Google default. Dynamic
            // import keeps the OSM module unloaded when the flag is off.
            const useOsmGeo = Deno.env.get("USE_OSM_GEOCODER") === "true";
            const geo = useOsmGeo
              ? await (await import("../_shared/osm.ts")).osmGeocode(input.location.label)
              : await geocode(input.location.label);
            if (!geo) throw new AppError("INVALID_LOCATION", "Localização não encontrada.");
            latitude = geo.latitude;
            longitude = geo.longitude;
            await recordUsage(ctx.adminClient, {
              organizationId: ctx.organizationId,
              userId: ctx.userId,
              eventType: "geocode_request",
              provider: useOsmGeo ? "nominatim" : "google_geocoding",
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
            max_results: Math.min(input.maxResults ?? 60, 60),
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

        // Fire-and-forget async execution via execute-search.
        fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/execute-search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ searchId: search.id }),
        }).catch(() => {
          // execute-search retries via cron pickup of queued searches.
        });

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
