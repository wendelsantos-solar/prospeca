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
  type NormalizedPhone,
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
        const materializedLeadIds: string[] = [];

        // ── Pre-compute normalized phone/domain for dedup batch ──
        // Instead of 3 sequential queries per place (N+1), we collect all
        // dedup keys and run 3 batch queries once. For a typical 10-place
        // import this drops from 30 queries to 3.
        const rows = (results ?? []) as unknown as Array<{
          place_id: string;
          distance_meters: number | null;
          places: Record<string, unknown> | null;
        }>;
        const nonsPlaceIds = rows.map((r) => r.place_id);
        const phones: string[] = [];
        const domains: string[] = [];
        const phoneByPlaceId = new Map<string, NormalizedPhone>();
        const domainByPlaceId = new Map<string, string>();
        const placeMeta = new Map<
          string,
          {
            phoneRaw: string | null;
            website: string | null;
            phone: NormalizedPhone | null;
            domain: string | null;
            websiteReal: boolean;
          }
        >();

        for (const row of rows) {
          const place = row.places;
          if (!place) continue;
          const phoneRaw = (place.national_phone_number ?? place.international_phone_number) as
            | string
            | null;
          const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
          const website = place.website_uri as string | null;
          const domain = normalizeDomain(website);
          const websiteReal = hasRealWebsite(website);
          placeMeta.set(row.place_id, { phoneRaw, website, phone, domain, websiteReal });
          if (phone?.e164) {
            phones.push(phone.e164);
            phoneByPlaceId.set(row.place_id, phone);
          }
          if (domain) {
            domains.push(domain);
            domainByPlaceId.set(row.place_id, domain);
          }
        }

        // ── Batch dedup lookups (3 queries total, not 3×N) ──
        const dedupByPlaceId = new Map<string, string>();
        const dedupByPhone = new Map<string, string>();
        const dedupByDomain = new Map<string, string>();

        if (nonsPlaceIds.length > 0) {
          const { data: byPlaceRows } = await ctx.adminClient
            .from("leads")
            .select("id, place_id")
            .eq("organization_id", ctx.organizationId)
            .in("place_id", nonsPlaceIds);
          for (const r of (byPlaceRows ?? []) as Array<{ id: string; place_id: string }>) {
            dedupByPlaceId.set(r.place_id, r.id);
          }
        }

        if (phones.length > 0) {
          const { data: byPhoneRows } = await ctx.adminClient
            .from("leads")
            .select("id, phone_e164")
            .eq("organization_id", ctx.organizationId)
            .in("phone_e164", phones);
          for (const r of (byPhoneRows ?? []) as Array<{ id: string; phone_e164: string }>) {
            if (r.phone_e164 && !dedupByPhone.has(r.phone_e164)) {
              dedupByPhone.set(r.phone_e164, r.id);
            }
          }
        }

        if (domains.length > 0) {
          const { data: byDomainRows } = await ctx.adminClient
            .from("leads")
            .select("id, website_domain")
            .eq("organization_id", ctx.organizationId)
            .in("website_domain", domains);
          for (const r of (byDomainRows ?? []) as Array<{ id: string; website_domain: string }>) {
            if (r.website_domain && !dedupByDomain.has(r.website_domain)) {
              dedupByDomain.set(r.website_domain, r.id);
            }
          }
        }

        // ── Process each place ──
        const rank: Record<string, number> = {
          new: 0,
          qualified: 1,
          contacted: 2,
          won: 3,
          discarded: -1,
        };

        for (const row of rows) {
          const place = row.places;
          if (!place) continue;
          const meta = placeMeta.get(row.place_id);
          if (!meta) continue;

          // Dedupe: check place_id → phone → domain (batch results).
          let existingId = dedupByPlaceId.get(row.place_id) ?? null;
          if (!existingId && meta.phone?.e164) {
            existingId = dedupByPhone.get(meta.phone.e164) ?? null;
          }
          if (!existingId && meta.domain) {
            existingId = dedupByDomain.get(meta.domain) ?? null;
          }

          if (existingId) {
            duplicates++;
            materializedLeadIds.push(existingId);
            // Promote stage if target is more advanced — never downgrade.
            const { data: cur } = await ctx.adminClient
              .from("leads")
              .select("stage")
              .eq("id", existingId)
              .maybeSingle();
            if (cur && (rank[input.stage] ?? 0) > (rank[cur.stage as string] ?? 0)) {
              await ctx.adminClient
                .from("leads")
                .update({ stage: input.stage, last_interaction_at: new Date().toISOString() })
                .eq("id", existingId);
            }
            await ctx.adminClient
              .from("search_results")
              .update({ imported_lead_id: existingId })
              .eq("search_id", input.searchId)
              .eq("place_id", row.place_id);
            continue;
          }

          // PostgREST serializes geography as hex EWKB, not GeoJSON — decode it.
          const coords = readPoint(place.location); // [lng, lat] | null
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
              neighborhood: addressParts.neighborhood,
              city: addressParts.city,
              state: addressParts.state,
              latitude: coords?.[1] ?? null,
              longitude: coords?.[0] ?? null,
              phone: meta.phoneRaw,
              phone_e164: meta.phone?.e164 ?? null,
              whatsapp:
                (place.whatsapp as string | null) ??
                (meta.phone?.type === "mobile" ? meta.phone.e164 : null),
              whatsapp_status: place.whatsapp
                ? "verified"
                : meta.phone?.type === "mobile"
                  ? "possible"
                  : "unknown",
              website: meta.website,
              website_domain: meta.domain,
              has_website: meta.websiteReal,
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
          materializedLeadIds.push(lead.id as string);
          if (meta.website && (meta.websiteReal || instagramHandleFromUrl(meta.website))) {
            enrichable.push({ leadId: lead.id as string, website: meta.website });
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

        return {
          imported,
          duplicates,
          enrichableLeadIds: enrichable.map((e) => e.leadId),
          leadIds: materializedLeadIds,
        };
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
