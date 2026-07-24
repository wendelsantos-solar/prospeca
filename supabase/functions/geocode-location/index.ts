// geocode-location: resolves a text label to coordinates, with cache.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage } from "../_shared/quota.ts";
import { geocode, reverseGeocode } from "../_shared/google.ts";

const InputSchema = z.union([
  z.object({ query: z.string().min(2).max(200) }),
  z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
]);

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Consulta inválida.");

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "geocode_request", 10);

    if ("latitude" in parsed.data) {
      const geo = await reverseGeocode(parsed.data.latitude, parsed.data.longitude);
      if (!geo) throw new AppError("INVALID_LOCATION", "Localização não encontrada.");
      await recordUsage(ctx.adminClient, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: "geocode_request",
        provider: "google_geocoding",
      });
      logEvent({ requestId, operation: "geocode-location", status: "ok" });
      return json({ ...geo, cached: false }, 200, {}, req);
    }

    const normalized = parsed.data.query.trim().toLowerCase();
    const { data: cached } = await ctx.adminClient
      .from("geocode_cache")
      .select("label, location")
      .eq("query_normalized", normalized)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.location?.coordinates) {
      const [lng, lat] = cached.location.coordinates as [number, number];
      return json(
        { label: cached.label, latitude: lat, longitude: lng, cached: true },
        200,
        {},
        req,
      );
    }

    const geo = await geocode(parsed.data.query);
    if (!geo) throw new AppError("INVALID_LOCATION", "Localização não encontrada.");

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
        location: `POINT(${geo.longitude} ${geo.latitude})`,
      },
      { onConflict: "query_normalized" },
    );

    logEvent({ requestId, operation: "geocode-location", status: "ok" });
    return json({ ...geo, cached: false }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
