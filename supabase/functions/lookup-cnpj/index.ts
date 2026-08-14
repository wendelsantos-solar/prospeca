// lookup-cnpj: resolve registration data (razão social, CNAE, situação) for a
// CNPJ and persist it ADDITIVELY on the place (tax_id, legal_name, primary_cnae,
// registration_status…). Returns the canonical BusinessRegistration so the UI
// can show trade name / CNAE text without another round-trip.
//
// Resilience (user requirements):
//   - The registry NEVER blocks discovery — a provider failure only marks the
//     source state `failed` (re-checkable, no TTL lock) and answers 200
//     {found:false, reason} — the company stays fully usable.
//   - {found:false} is a NORMAL answer (valid CNPJ the registry does not know)
//     — recorded as a DEFINITIVE source answer with the 90d registry TTL, never
//     an error, never a score/profile cascade.
//   - Provenance: company_sources (provider 'business_registry',
//     source_type 'registry') + enrichment_sources.business_registry with
//     status/fetchedAt/expiresAt (TTL 90d — no re-consult on every drawer open).
//
// Modes:
//   - Authenticated (frontend) — org from the JWT, rate-limited.
//   - Internal (service-role) — organizationId from the body, validated against
//     the place's org; no user rate limit.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient, requireAuth } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import { isValidCnpj, normalizeCnpj } from "@leads/domain/business-registry";
import {
  businessRegistryProvider,
  isBusinessRegistryDisabled,
} from "../_shared/business-registry.ts";
import {
  buildSourceState,
  ENRICHMENT_SOURCE_TTL_DAYS,
  type EnrichmentSourceMap,
} from "@leads/domain/enrichment-state";

const InputSchema = z.object({
  placeId: z.string().uuid(),
  cnpj: z.string().min(1).max(20),
  /** Internal (service-role) calls only — validated against the place's org. */
  organizationId: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { placeId, cnpj } = parsed.data;

    const taxId = normalizeCnpj(cnpj);
    if (!isValidCnpj(taxId)) {
      throw new AppError("VALIDATION_ERROR", "CNPJ inválido.");
    }

    const internal = await isInternalCall(req);
    let organizationId: string;
    if (internal) {
      organizationId = parsed.data.organizationId ?? "";
      if (!organizationId) {
        throw new AppError("VALIDATION_ERROR", "organizationId obrigatório (chamada interna).");
      }
    } else {
      const ctx = await requireAuth(req);
      organizationId = ctx.organizationId;
      await assertRateLimit(ctx.adminClient, organizationId, "cnpj_lookup", 30);
    }

    const admin = adminClient();

    // Place must belong to the caller's org (authenticated) / body's org (internal).
    const { data: place } = await admin
      .from("places")
      .select("id, enrichment_sources")
      .eq("id", placeId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!place) throw new AppError("LEAD_NOT_FOUND", "Empresa não encontrada.");

    const stampSource = async (status: "enriched" | "failed") => {
      const prior = (place.enrichment_sources as EnrichmentSourceMap | null) ?? {};
      const sources: EnrichmentSourceMap = {
        ...prior,
        business_registry: buildSourceState(
          status,
          new Date(),
          ENRICHMENT_SOURCE_TTL_DAYS.business_registry,
        ),
      };
      await admin.from("places").update({ enrichment_sources: sources }).eq("id", placeId);
    };

    const upsertSourceRow = async (
      confidence: number,
      providerExternalId?: string | null,
      metadata?: Record<string, unknown>,
    ) => {
      const { data: existing } = await admin
        .from("company_sources")
        .select("id, attempts")
        .eq("organization_id", organizationId)
        .eq("place_id", placeId)
        .eq("provider", "business_registry")
        .maybeSingle();
      const row = {
        organization_id: organizationId,
        place_id: placeId,
        provider: "business_registry",
        provider_external_id: providerExternalId ?? null,
        source_type: "registry",
        fetched_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + ENRICHMENT_SOURCE_TTL_DAYS.business_registry * 86400000,
        ).toISOString(),
        confidence,
        attempts: ((existing?.attempts as number | null) ?? 0) + 1,
        error: null,
        metadata: metadata ?? null,
      };
      if (existing) {
        await admin.from("company_sources").update(row).eq("id", existing.id as string);
      } else {
        await admin.from("company_sources").insert(row).select("id").maybeSingle();
      }
    };

    /** Registry source errored — attempts+1, error text, metadata (V3-D). */
    const markSourceError = async (message: string) => {
      const { data: existing } = await admin
        .from("company_sources")
        .select("id, attempts")
        .eq("organization_id", organizationId)
        .eq("place_id", placeId)
        .eq("provider", "business_registry")
        .maybeSingle();
      const row = {
        organization_id: organizationId,
        place_id: placeId,
        provider: "business_registry",
        source_type: "registry",
        fetched_at: new Date().toISOString(),
        confidence: 0,
        attempts: ((existing?.attempts as number | null) ?? 0) + 1,
        error: message,
        metadata: { lastErrorAt: new Date().toISOString() },
      };
      if (existing) {
        await admin.from("company_sources").update(row).eq("id", existing.id as string);
      } else {
        await admin.from("company_sources").insert(row).select("id").maybeSingle();
      }
    };

    // Provider disabled: honest no-op answer — never fabricate, never block.
    if (isBusinessRegistryDisabled()) {
      await stampSource("failed");
      logEvent({
        requestId,
        organizationId,
        operation: "lookup-cnpj",
        status: "provider_disabled",
      });
      return json({ found: false, reason: "provider_disabled" }, 200, {}, req);
    }

    // Provider lookup — null = registry has no record (normal); throw = the
    // source is DOWN (timeout/5xx). Down ≠ company failure: source failed,
    // company untouched.
    let registration;
    try {
      registration = await businessRegistryProvider().lookupByCnpj(taxId);
    } catch (providerErr) {
      await stampSource("failed");
      await markSourceError(providerErr instanceof Error ? providerErr.message : String(providerErr));
      logEvent({
        requestId,
        organizationId,
        operation: "lookup-cnpj",
        status: "provider_error",
        error: providerErr instanceof Error ? providerErr.message : String(providerErr),
      });
      return json(
        { found: false, reason: "provider_unavailable" },
        200,
        {},
        req,
      );
    }

    if (!registration) {
      // Valid CNPJ the registry does not know — a DEFINITIVE answer, not an
      // error. Stamped as enriched with the 90d TTL so we don't re-consult on
      // every drawer open.
      await stampSource("enriched");
      await upsertSourceRow(0.9, null, { result: "not_found" });
      logEvent({
        requestId,
        organizationId,
        operation: "lookup-cnpj",
        status: "not_found",
      });
      return json({ found: false, reason: "not_found" }, 200, {}, req);
    }

    // Additive: only stamp non-null fields; never null out existing columns.
    const patch: Record<string, unknown> = {
      tax_id: registration.taxId,
      registration_status: registration.status,
      registration_fetched_at: registration.fetchedAt,
      // V3-D registry details — never overwrite Google/provider columns.
      company_size: registration.companySize,
      legal_nature: registration.legalNature,
      capital_social: registration.capitalSocial,
      simples_nacional: registration.simplesNacional,
      simples_opted_at: registration.simplesOptedAt,
      is_mei: registration.isMei,
      founded_at: registration.foundedAt,
      registry_city: registration.city,
      registry_state: registration.state,
      registry_postal_code: registration.postalCode,
      registry_email: registration.email,
      registry_phone: registration.phone,
    };
    if (registration.legalName) patch.legal_name = registration.legalName;
    if (registration.primaryCnae) patch.primary_cnae = registration.primaryCnae;
    if (registration.cnaeDescription) patch.cnae_description = registration.cnaeDescription;
    if (registration.secondaryCnaes.length) patch.secondary_cnaes = registration.secondaryCnaes;
    if (registration.statusDescription)
      patch.registration_status_description = registration.statusDescription;

    await admin.from("places").update(patch).eq("id", placeId);
    await stampSource("enriched");
    await upsertSourceRow(1, registration.taxId, { result: "found", foundAt: registration.fetchedAt });

    logEvent({
      requestId,
      organizationId,
      operation: "lookup-cnpj",
      status: "ok",
    });
    return json({ found: true, registration }, 200, {}, req);
  } catch (err) {
    if (err instanceof AppError) return err.toResponse(requestId, req);
    logEvent({ requestId, operation: "lookup-cnpj", status: "error" });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
