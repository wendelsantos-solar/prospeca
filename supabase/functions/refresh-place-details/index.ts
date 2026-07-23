// refresh-place-details: refreshes only stale provider records (past
// provider_refresh_after), minimal FieldMask, no duplicate calls.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit, recordUsage } from "../_shared/quota.ts";
import { placeDetails } from "../_shared/google.ts";

const InputSchema = z.object({ placeIds: z.array(z.string().uuid()).min(1).max(20) });

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "place_details_request", 20);

    const { data: stale } = await ctx.adminClient
      .from("places")
      .select("id, provider_place_id")
      .eq("organization_id", ctx.organizationId)
      .in("id", parsed.data.placeIds)
      .lt("provider_refresh_after", new Date().toISOString());

    let refreshed = 0;
    for (const place of stale ?? []) {
      const details = await placeDetails(place.provider_place_id);
      if (!details) continue; // no place found -> skip, don't count
      await recordUsage(ctx.adminClient, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: "place_details_request",
        provider: "google_places",
      });
      await ctx.adminClient
        .from("places")
        .update({
          name: details.displayName?.text ?? undefined,
          formatted_address: details.formattedAddress ?? null,
          national_phone_number: details.nationalPhoneNumber ?? null,
          international_phone_number: details.internationalPhoneNumber ?? null,
          website_uri: details.websiteUri ?? null,
          business_status: details.businessStatus ?? null,
          rating: details.rating ?? null,
          user_rating_count: details.userRatingCount ?? null,
          opening_hours: details.regularOpeningHours ?? null,
          address_components: details.addressComponents ?? null,
          provider_fetched_at: new Date().toISOString(),
          provider_refresh_after: new Date(Date.now() + 30 * 86400_000).toISOString(),
        })
        .eq("id", place.id);
      refreshed++;
    }

    logEvent({
      requestId,
      operation: "refresh-place-details",
      status: "ok",
      resultCount: refreshed,
    });
    return json({ refreshed, skipped: parsed.data.placeIds.length - refreshed });
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId);
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId);
  }
});
