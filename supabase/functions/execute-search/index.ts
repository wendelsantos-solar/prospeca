// execute-search: internal worker. Calls Google Places (Text Search),
// paginates within limits, upserts places, links search_results,
// validates distance with PostGIS, updates progress. Service-role only.
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { recordUsage } from "../_shared/quota.ts";
import { textSearch, type GooglePlace } from "../_shared/google.ts";
import { hasRealWebsite } from "../_shared/normalize.ts";
import { readPoint } from "../_shared/geo.ts";

const ABSOLUTE_MAX_PAGES = 3; // hard technical cap per execution

function isInternalCall(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
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

  if (!isInternalCall(req)) {
    return new AppError("FORBIDDEN", "Função interna.").toResponse(requestId);
  }

  const admin = adminClient();
  let searchId: string | null = null;

  try {
    const body = await req.json();
    searchId = body.searchId as string;
    if (!searchId) throw new AppError("VALIDATION_ERROR", "searchId obrigatório.");

    const { data: search } = await admin
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .maybeSingle();
    if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");
    if (!["queued", "searching"].includes(search.status)) {
      return json({ searchId, status: search.status, skipped: true });
    }

    await admin
      .from("searches")
      .update({ status: "searching", started_at: new Date().toISOString() })
      .eq("id", searchId);

    // PostgREST returns geography(point) as hex EWKB, not GeoJSON — decode it.
    const center = readPoint(search.center);
    if (!center) throw new AppError("INVALID_LOCATION", "Centro da busca inválido.");
    const [centerLng, centerLat] = center;

    const maxResults: number = search.max_results ?? 60;
    const textQuery = search.category ? `${search.query} ${search.category}` : search.query;
    let requestCount = 0;
    let collected: GooglePlace[] = [];

    // Strangler: OSM (Overpass) only when explicitly enabled; Google is default.
    // Dynamic import keeps the OSM module unloaded when the flag is off.
    const useOsm = Deno.env.get("USE_OSM_PLACES") === "true";

    if (useOsm) {
      const { placesCacheKey } = await import("../_shared/cache.ts");
      const cacheKey = placesCacheKey({
        provider: "overpass",
        category: textQuery,
        latitude: centerLat,
        longitude: centerLng,
        radiusMeters: search.radius_meters,
      });

      // Cache: skip the external Overpass call when an equivalent recent search
      // exists (region+category bucketed). TTL enforced via expires_at.
      const { data: cachedRow } = await admin
        .from("provider_search_cache")
        .select("payload, hit_count")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cachedRow?.payload) {
        collected = cachedRow.payload as GooglePlace[];
        requestCount = 0;
        await admin
          .from("provider_search_cache")
          .update({ hit_count: (cachedRow.hit_count ?? 0) + 1 })
          .eq("cache_key", cacheKey);
      } else {
        const { osmSearchBusinesses } = await import("../_shared/osm.ts");
        const { dedupeRecords } = await import("../_shared/dedup.ts");
        const res = await osmSearchBusinesses({
          query: textQuery,
          latitude: centerLat,
          longitude: centerLng,
          radiusMeters: search.radius_meters,
          maxResults,
        });
        // Overpass returns node + way for the same business; collapse duplicates
        // by the multi-signal matcher before persisting.
        const keep = new Set(
          dedupeRecords(
            res.places.map((p) => ({
              id: p.id,
              name: p.displayName?.text ?? "",
              phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
              website: p.websiteUri ?? null,
              latitude: p.location?.latitude ?? null,
              longitude: p.location?.longitude ?? null,
              externalId: p.id,
              source: "overpass",
            })),
          ).map((r) => r.id),
        );
        collected = res.places.filter((p) => keep.has(p.id));
        requestCount = 1;
        await recordUsage(admin, {
          organizationId: search.organization_id,
          eventType: "place_search_request",
          provider: "overpass",
          quantity: 1,
          metadata: { searchId },
        });
        await admin.from("provider_search_cache").upsert(
          {
            cache_key: cacheKey,
            organization_id: search.organization_id,
            provider: "overpass",
            payload: collected,
            result_count: collected.length,
          },
          { onConflict: "cache_key" },
        );
      }

      await admin
        .from("searches")
        .update({
          provider_request_count: requestCount,
          found_count: collected.length,
          search_provider: "overpass",
        })
        .eq("id", searchId);
    } else {
      let pageToken: string | undefined;
      for (let page = 0; page < ABSOLUTE_MAX_PAGES; page++) {
        const res = await textSearch({
          textQuery,
          latitude: centerLat,
          longitude: centerLng,
          radiusMeters: search.radius_meters,
          pageToken,
        });
        requestCount++;
        await recordUsage(admin, {
          organizationId: search.organization_id,
          eventType: "place_search_request",
          provider: "google_places",
          quantity: 1,
          metadata: { searchId, page },
        });
        collected = collected.concat(res.places);
        await admin
          .from("searches")
          .update({ provider_request_count: requestCount, found_count: collected.length })
          .eq("id", searchId);
        if (!res.nextPageToken || collected.length >= maxResults) break;
        pageToken = res.nextPageToken;
      }
    }

    collected = collected.slice(0, maxResults);
    const providerName = useOsm ? "overpass" : "google_places";

    // Cancelled mid-flight?
    const { data: fresh } = await admin
      .from("searches")
      .select("status")
      .eq("id", searchId)
      .single();
    if (fresh?.status === "cancelled") return json({ searchId, status: "cancelled" });

    await admin.from("searches").update({ status: "importing" }).eq("id", searchId);

    let position = 0;
    let insideCount = 0;
    for (const place of collected) {
      position++;
      const lat = place.location?.latitude ?? null;
      const lng = place.location?.longitude ?? null;
      const distance =
        lat != null && lng != null ? haversineMeters(centerLat, centerLng, lat, lng) : null;
      const inside = distance != null ? distance <= search.radius_meters : false;
      // Recorte fino ao círculo: o searchText restringe ao retângulo (bbox);
      // aqui descartamos os cantos que ficam fora do raio real. Lugares sem
      // coordenada (distance null) passam — não dá para afirmar que estão fora.
      if (distance != null && !inside) continue;
      if (inside) insideCount++;

      const websiteReal = hasRealWebsite(place.websiteUri);
      if (search.presence_filter === "without_website" && websiteReal) continue;
      if (search.presence_filter === "with_website" && !websiteReal) continue;

      const { data: upserted, error: upsertError } = await admin
        .from("places")
        .upsert(
          {
            organization_id: search.organization_id,
            provider: providerName,
            provider_place_id: place.id,
            name: place.displayName?.text ?? "Sem nome",
            primary_type: place.primaryType ?? null,
            types: place.types ?? [],
            formatted_address: place.formattedAddress ?? null,
            location: lat != null && lng != null ? `POINT(${lng} ${lat})` : null,
            national_phone_number: place.nationalPhoneNumber ?? null,
            international_phone_number: place.internationalPhoneNumber ?? null,
            website_uri: place.websiteUri ?? null,
            google_maps_uri: place.googleMapsUri ?? null,
            business_status: place.businessStatus ?? null,
            rating: place.rating ?? null,
            user_rating_count: place.userRatingCount ?? null,
            provider_fetched_at: new Date().toISOString(),
            provider_refresh_after: new Date(Date.now() + 30 * 86400_000).toISOString(),
          },
          { onConflict: "organization_id,provider,provider_place_id" },
        )
        .select("id")
        .single();
      if (upsertError || !upserted) continue;

      await admin.from("search_results").upsert(
        {
          search_id: searchId,
          place_id: upserted.id,
          distance_meters: distance,
          position,
          provider_rank: position,
          matched_query: search.query,
          is_inside_radius: inside,
        },
        { onConflict: "search_id,place_id" },
      );
    }

    await admin
      .from("searches")
      .update({
        status: "completed",
        found_count: collected.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", searchId);

    // Auto-materialize leads from this search (default on; set
    // AUTO_IMPORT_LEADS=false to keep import as a manual user action).
    if (Deno.env.get("AUTO_IMPORT_LEADS") !== "false") {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/import-search-results`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            searchId,
            importAll: true,
            organizationId: search.organization_id,
            userId: search.created_by,
          }),
        });
      } catch (_e) {
        // Non-fatal: leads can still be imported manually from the UI.
      }
    }

    logEvent({
      requestId,
      searchId,
      organizationId: search.organization_id,
      provider: "google_places",
      operation: "execute-search",
      durationMs: Date.now() - startedAt,
      status: "completed",
      requestCount,
      resultCount: collected.length,
      insideRadius: insideCount,
    });
    return json({ searchId, status: "completed", found: collected.length });
  } catch (err) {
    const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
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
          error_message: code,
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
    if (err instanceof AppError) return err.toResponse(requestId);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId);
  }
});
