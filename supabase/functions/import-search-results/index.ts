// import-search-results: turns selected search results into CRM leads.
// Dedupe: provider_place_id → normalized phone → website domain.
// Never overwrites commercial data on existing leads.
import { ImportSearchResultsSchema } from "@leads/contracts/schemas";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { readPoint } from "@leads/geo";
import { writeAudit } from "../_shared/quota.ts";
import { withIdempotency } from "../_shared/idempotency.ts";
import { scoreInputFromRow, type PlaceRow } from "@leads/domain/score-input";
import {
  hasRealWebsite,
  instagramHandleFromUrl,
  normalizeCompanyName,
  normalizeDomain,
  normalizePhone,
} from "@leads/domain/normalize";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "@leads/domain/score";
import { parseAddress } from "@leads/domain/address";

const InputSchema = ImportSearchResultsSchema;

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const raw = await req.json();
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const input = parsed.data;
    const idempotencyKey = req.headers.get("x-idempotency-key");

    // Internal (service-role) calls — e.g. auto-import fired by execute-search —
    // carry org/user in the body and skip requireAuth.
    const internal =
      (req.headers.get("Authorization") ?? "") ===
      `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    let ctx: {
      adminClient: ReturnType<typeof adminClient>;
      userClient: ReturnType<typeof adminClient>;
      organizationId: string;
      userId: string;
    };
    if (internal) {
      const admin = adminClient();
      const organizationId = raw.organizationId as string | undefined;
      const userId = raw.userId as string | undefined;
      if (!organizationId || !userId)
        throw new AppError("VALIDATION_ERROR", "organizationId/userId obrigatórios (interno).");
      ctx = { adminClient: admin, userClient: admin, organizationId, userId };
    } else {
      const authed = await requireAuth(req);
      ctx = {
        adminClient: authed.adminClient,
        userClient: authed.userClient,
        organizationId: authed.organizationId,
        userId: authed.userId,
      };
    }

    const result = await withIdempotency(
      ctx.adminClient,
      ctx.organizationId,
      idempotencyKey,
      "import-search-results",
      async () => {
        const { data: search } = await ctx.userClient
          .from("searches")
          .select("id, organization_id, center")
          .eq("id", input.searchId)
          .maybeSingle();
        if (!search) throw new AppError("SEARCH_NOT_FOUND", "Busca não encontrada.");

        let query = ctx.adminClient
          .from("search_results")
          .select("place_id, distance_meters, imported_lead_id, places(*)")
          .eq("search_id", input.searchId)
          .is("imported_lead_id", null);
        if (!input.importAll && input.placeIds.length > 0) {
          query = query.in("place_id", input.placeIds);
        }
        const { data: results } = await query.limit(200);

        let imported = 0;
        let duplicates = 0;
        // Leads recém-criados que têm site → o cliente dispara enrich sob demanda.
        const enrichable: { leadId: string; website: string }[] = [];

        for (const row of results ?? []) {
          const place = row.places as unknown as Record<string, unknown> | null;
          if (!place) continue;

          const phoneRaw = (place.national_phone_number ?? place.international_phone_number) as
            | string
            | null;
          const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
          const domain = normalizeDomain(place.website_uri as string | null);

          // Dedupe chain
          let existing: { id: string } | null = null;
          const { data: byPlace } = await ctx.adminClient
            .from("leads")
            .select("id")
            .eq("organization_id", ctx.organizationId)
            .eq("place_id", row.place_id)
            .maybeSingle();
          existing = byPlace;
          if (!existing && phone?.e164) {
            const { data } = await ctx.adminClient
              .from("leads")
              .select("id")
              .eq("organization_id", ctx.organizationId)
              .eq("phone_e164", phone.e164)
              .maybeSingle();
            existing = data;
          }
          if (!existing && domain) {
            const { data } = await ctx.adminClient
              .from("leads")
              .select("id")
              .eq("organization_id", ctx.organizationId)
              .eq("website_domain", domain)
              .maybeSingle();
            existing = data;
          }

          if (existing) {
            duplicates++;
            // Promove o estágio se o alvo for mais avançado — nunca rebaixa.
            const rank: Record<string, number> = {
              new: 0,
              qualified: 1,
              contacted: 2,
              won: 3,
              discarded: -1,
            };
            const { data: cur } = await ctx.adminClient
              .from("leads")
              .select("stage")
              .eq("id", existing.id)
              .maybeSingle();
            if (cur && (rank[input.stage] ?? 0) > (rank[cur.stage as string] ?? 0)) {
              await ctx.adminClient
                .from("leads")
                .update({ stage: input.stage, last_interaction_at: new Date().toISOString() })
                .eq("id", existing.id);
            }
            await ctx.adminClient
              .from("search_results")
              .update({ imported_lead_id: existing.id })
              .eq("search_id", input.searchId)
              .eq("place_id", row.place_id);
            continue;
          }

          const websiteReal = hasRealWebsite(place.website_uri as string | null);
          // PostgREST serializes geography as hex EWKB, not GeoJSON — decode it.
          const coords = readPoint(place.location); // [lng, lat] | null
          // Same signals as discovery — hand-building this input made an enriched
          // business score lower here than it did on the map.
          const breakdown = calculateScore(
            scoreInputFromRow(place as PlaceRow, row.distance_meters),
          );
          const addressParts = parseAddress(
            place.formatted_address as string | null,
            place.address_components,
          );

          const { data: lead, error } = await ctx.adminClient
            .from("leads")
            .insert({
              organization_id: ctx.organizationId,
              place_id: row.place_id,
              created_by: ctx.userId,
              company_name: place.name,
              category: place.primary_type ?? null,
              address: place.formatted_address ?? null,
              // Bairro/cidade/UF vêm do endereço do Google — sem isso os filtros
              // por cidade/bairro (leads.city / leads.neighborhood) ficam vazios.
              neighborhood: addressParts.neighborhood,
              city: addressParts.city,
              state: addressParts.state,
              latitude: coords?.[1] ?? null,
              longitude: coords?.[0] ?? null,
              phone: phoneRaw,
              phone_e164: phone?.e164 ?? null,
              // A scraped WhatsApp (enrich-discovery) wins over phone inference.
              whatsapp:
                (place.whatsapp as string | null) ?? (phone?.type === "mobile" ? phone.e164 : null),
              whatsapp_status: place.whatsapp
                ? "verified"
                : phone?.type === "mobile"
                  ? "possible"
                  : "unknown",
              website: place.website_uri ?? null,
              website_domain: domain,
              has_website: websiteReal,
              rating: place.rating ?? null,
              review_count: place.user_rating_count ?? null,
              score: breakdown.total,
              score_breakdown: breakdown,
              score_rule_version: SCORE_RULE_VERSION,
              temperature: temperatureFromScore(breakdown.total),
              stage: input.stage,
              source: "search",
              source_search_id: input.searchId,
              name_normalized: normalizeCompanyName(place.name as string),
            })
            .select("id")
            .single();
          if (error || !lead) continue;

          imported++;
          // Also enqueue instagram-as-website leads: not a "real" site, but
          // enrichFromWebsite pulls the handle straight from that URL.
          if (
            place.website_uri &&
            (websiteReal || instagramHandleFromUrl(place.website_uri as string))
          ) {
            enrichable.push({ leadId: lead.id as string, website: place.website_uri as string });
          }
          await ctx.adminClient
            .from("search_results")
            .update({ imported_lead_id: lead.id })
            .eq("search_id", input.searchId)
            .eq("place_id", row.place_id);
          await writeAudit(ctx.adminClient, {
            organizationId: ctx.organizationId,
            actorUserId: ctx.userId,
            action: "lead.imported",
            entityType: "lead",
            entityId: lead.id,
            metadata: { searchId: input.searchId },
          });
        }

        await ctx.adminClient.rpc("get_quota_status", { p_organization_id: ctx.organizationId });
        const { count: totalImported } = await ctx.adminClient
          .from("search_results")
          .select("id", { count: "exact", head: true })
          .eq("search_id", input.searchId)
          .not("imported_lead_id", "is", null);
        await ctx.adminClient
          .from("searches")
          .update({ imported_count: totalImported ?? imported })
          .eq("id", input.searchId);

        return { imported, duplicates, enrichableLeadIds: enrichable.map((e) => e.leadId) };
      },
    );

    logEvent({ requestId, operation: "import-search-results", status: "ok", ...result });
    return json(result, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "import-search-results", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
