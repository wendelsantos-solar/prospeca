// lookup-cnpj: resolve registration data (razão social, CNAE, situação) for a
// CNPJ and persist it ADDITIVELY on the place (tax_id, legal_name, primary_cnae,
// registration_status…). Returns the canonical BusinessRegistration so the UI
// can show trade name / CNAE text without another round-trip.
//
// Body: { placeId: uuid, cnpj: string }. The CNPJ is checksum-validated
// (domain); an invalid one is a 422, a valid-but-unknown one is 200 {found:false}.
// When the provider is disabled (BUSINESS_REGISTRY_DISABLED=true) the Noop
// returns null and the function answers {found:false} honestly.
import { z } from "npm:zod@3";
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { requireAuth } from "../_shared/auth.ts";
import { assertRateLimit } from "../_shared/quota.ts";
import { isValidCnpj, normalizeCnpj } from "@leads/domain/business-registry";
import { businessRegistryProvider } from "../_shared/business-registry.ts";

const InputSchema = z.object({
  placeId: z.string().uuid(),
  cnpj: z.string().min(1).max(20),
});

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();

  try {
    const ctx = await requireAuth(req);
    const parsed = InputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Entrada inválida.");
    const { placeId, cnpj } = parsed.data;

    const taxId = normalizeCnpj(cnpj);
    if (!isValidCnpj(taxId)) {
      throw new AppError("VALIDATION_ERROR", "CNPJ inválido.");
    }

    await assertRateLimit(ctx.adminClient, ctx.organizationId, "cnpj_lookup", 30);

    // Place must belong to the caller's org.
    const { data: place } = await ctx.adminClient
      .from("places")
      .select("id")
      .eq("id", placeId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (!place) throw new AppError("LEAD_NOT_FOUND", "Empresa não encontrada.");

    const registration = await businessRegistryProvider().lookupByCnpj(taxId);
    if (!registration) {
      logEvent({
        requestId,
        organizationId: ctx.organizationId,
        operation: "lookup-cnpj",
        status: "not_found",
      });
      return json({ found: false }, 200, {}, req);
    }

    // Additive: only stamp non-null fields; never null out existing columns.
    const patch: Record<string, unknown> = {
      tax_id: registration.taxId,
      registration_status: registration.status,
      registration_fetched_at: registration.fetchedAt,
    };
    if (registration.legalName) patch.legal_name = registration.legalName;
    if (registration.primaryCnae) patch.primary_cnae = registration.primaryCnae;
    if (registration.cnaeDescription) patch.cnae_description = registration.cnaeDescription;
    if (registration.secondaryCnaes.length) patch.secondary_cnaes = registration.secondaryCnaes;
    if (registration.statusDescription)
      patch.registration_status_description = registration.statusDescription;

    await ctx.adminClient.from("places").update(patch).eq("id", placeId);

    logEvent({
      requestId,
      organizationId: ctx.organizationId,
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
