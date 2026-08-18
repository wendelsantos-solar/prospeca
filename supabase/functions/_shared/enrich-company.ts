// enrich-company: single-place enrichment core, shared by the interactive
// enrich-discovery endpoint AND the process-jobs worker (BUSINESS_DATA_ENRICHMENT).
//
// Runs the full per-company pass:
//   1. job lifecycle — reuses the jobId passed by the worker, or enqueues a
//      dedupe-aware BUSINESS_DATA_ENRICHMENT row (interactive path);
//   2. scrape of the business's OWN website (SSRF-guarded, one retry on
//      transient errors);
//   3. per-field enrichment state (email/instagram/whatsapp) via the pure
//      domain machine (deriveEnrichmentState/buildFieldMap);
//   4. additive patch on `places` (never nulls a column);
//   5. re-score of the affected search_results with the legacy v3.0.0 rule
//      (the V2 opportunity score is re-computed by score-company — OPPORTUNITY
//      _SCORING job — after enrichment lands);
//   6. close the job (completed / retrying / failed via the queue's retry
//      classification).
//
// Idempotent by design: re-running the same pass reuses the same job row
// (unique idempotency key) and the patch is additive.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { enrichFromWebsite } from "./enrich.ts";
import {
  buildFieldMap,
  buildSourceState,
  deriveEnrichmentState,
  ENRICHMENT_SOURCE_TTL_DAYS,
  type EnrichmentFieldMap,
  type EnrichmentFieldName,
  type EnrichmentSourceMap,
} from "@leads/domain/enrichment-state";
import { companyProcessingKey } from "@leads/domain/job";
import { isEnrichmentSourceStale } from "@leads/domain/enrichment-state";
import { websiteCnpjConfidence } from "@leads/domain/business-registry";
import { calculateUsageCost } from "@leads/domain/cost-model";
import { createSupabaseJobQueue, stampJobMetrics } from "./job-queue.ts";

export const SITE_TIMEOUT_MS = 4000;

/**
 * Custo do pass de enrichment: scrape do site da PRÓPRIA empresa (infra
 * própria, sem fee por chamada) — zero COMPROVADO ('measured'), nunca
 * desconhecido disfarçado de 0 (regra dura da Fase 7).
 */
export function enrichmentJobCost(): Parameters<typeof stampJobMetrics>[2] {
  const c = calculateUsageCost("website_scraper", "enrich_request", 1);
  return {
    realCostUsd: c.realCostUsd,
    estimatedCostUsd: c.estimatedCostUsd,
    costSource: c.source,
  };
}
export const ENRICHMENT_STALE_DAYS = 30;

/** Confidence of the website source: grows with answered contact fields
 * (email/instagram/whatsapp); a scrape that verified and found nothing still
 * contributes a small honest confidence (it answered, with zero findings). */
export function websiteSourceConfidence(found: number): number {
  if (found <= 0) return 0.1;
  return Math.min(0.9, 0.4 + found * 0.2);
}

/** Insert-or-refresh the `website` provenance row for a place. */
export async function upsertWebsiteSource(
  admin: SupabaseClient,
  args: { organizationId: string; placeId: string; found: number; website: string },
): Promise<void> {
  const { data: existing } = await admin
    .from("company_sources")
    .select("id, attempts")
    .eq("organization_id", args.organizationId)
    .eq("place_id", args.placeId)
    .eq("provider", "website")
    .maybeSingle();

  const row = {
    organization_id: args.organizationId,
    place_id: args.placeId,
    provider: "website",
    provider_external_id: args.website || null,
    source_type: "enrichment",
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ENRICHMENT_STALE_DAYS * 86400000).toISOString(),
    confidence: websiteSourceConfidence(args.found),
    attempts: ((existing?.attempts as number | null) ?? 0) + 1,
    error: null,
    metadata: { fieldsFound: args.found },
  };

  if (existing) {
    await admin
      .from("company_sources")
      .update(row)
      .eq("id", existing.id as string);
  } else {
    await admin.from("company_sources").insert(row).select("id").maybeSingle();
  }
}

/**
 * Registra a PISTA de CNPJ achada no site como fonte própria.
 *
 * Provider distinto (`website_cnpj`) e não `website`: são afirmações
 * diferentes, com confiança diferente e vida útil diferente. Misturar as duas
 * na mesma linha faria a confiança do CNPJ herdar a do scraping de contato.
 *
 * A metadata guarda TODOS os candidatos, não só o escolhido — quando o site
 * lista mais de um número, a decisão precisa ser auditável depois.
 */
export async function upsertWebsiteCnpjSource(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    placeId: string;
    candidates: string[];
    chosen: string;
    website: string;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from("company_sources")
    .select("id, attempts")
    .eq("organization_id", args.organizationId)
    .eq("place_id", args.placeId)
    .eq("provider", "website_cnpj")
    .maybeSingle();

  const row = {
    organization_id: args.organizationId,
    place_id: args.placeId,
    provider: "website_cnpj",
    provider_external_id: args.chosen,
    source_type: "registry_hint",
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ENRICHMENT_STALE_DAYS * 86400000).toISOString(),
    confidence: websiteCnpjConfidence(args.candidates.length),
    attempts: ((existing?.attempts as number | null) ?? 0) + 1,
    error: null,
    metadata: {
      candidates: args.candidates,
      chosen: args.chosen,
      sourceUrl: args.website,
      ambiguous: args.candidates.length > 1,
    },
  };

  if (existing) {
    await admin
      .from("company_sources")
      .update(row)
      .eq("id", existing.id as string);
  } else {
    await admin.from("company_sources").insert(row).select("id").maybeSingle();
  }
}

export interface EnrichOnePlaceArgs {
  admin: SupabaseClient;
  organizationId: string;
  searchId: string;
  placeId: string;
  /** Worker path: the claimed job this pass belongs to (closed by this fn). */
  jobId?: string | null;
  /** Raw `places` row joined from search_results (contains website_uri etc.). */
  place: Record<string, unknown>;
  distanceMeters: number | null;
}

export interface EnrichOnePlaceResult {
  placeId: string;
  found: number;
  status: "ok" | "not_found" | "blocked" | "error";
}

export async function enrichOnePlace(args: EnrichOnePlaceArgs): Promise<EnrichOnePlaceResult> {
  const { admin, organizationId, searchId, placeId, place } = args;
  const queue = createSupabaseJobQueue(admin);

  // ── Job lifecycle: reuse the worker's claimed job or create (dedupe-aware) ──
  let jobId = args.jobId ?? null;
  if (!jobId) {
    // Interactive path: create the observable row ALREADY 'processing' — a
    // 'queued' row could be claimed by the worker concurrently and duplicate
    // the scrape. The unique partial index dedupes re-passes to the same row.
    const idempotencyKey = companyProcessingKey(organizationId, searchId, placeId);
    const row = {
      organization_id: organizationId,
      type: "BUSINESS_DATA_ENRICHMENT",
      search_id: searchId,
      place_id: placeId,
      status: "processing",
      attempt: 1,
      priority: 0,
      payload: { website: (place.website_uri as string | null) ?? null },
      idempotency_key: idempotencyKey,
      started_at: new Date().toISOString(),
    };
    const { data: inserted } = await admin
      .from("jobs")
      .upsert(row, {
        onConflict: "organization_id,idempotency_key",
        ignoreDuplicates: true,
      })
      .select("id")
      .maybeSingle();
    if (inserted) {
      jobId = inserted.id as string;
    } else {
      const { data: existing } = await admin
        .from("jobs")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (!existing) throw new Error("job row: unique idempotency_key sem linha correspondente");
      jobId = existing.id as string;
    }
  }

  // Mark the job row as processing (re-entry is safe — same row; for worker
  // jobs this re-stamps the pass that was already claimed).
  await admin
    .from("jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), error: null })
    .eq("id", jobId);

  // Mark in-flight before the slow scrape so a mid-flight crash leaves a
  // recoverable "processing" state, not a misleading "pending".
  await admin.from("places").update({ enrichment_state: "processing" }).eq("id", placeId);

  try {
    const website = (place.website_uri as string | null) ?? null;
    if (!website) {
      // Nothing to scrape — a definitive "not_found" answer for all fields.
      await stampJobMetrics(admin, jobId, enrichmentJobCost());
      await queue.complete(jobId, { fieldsFound: 0, enrichmentStatus: "not_found" });
      return { placeId, found: 0, status: "not_found" };
    }

    // One retry on transient provider errors (timeout / 5xx). Definitive
    // "not_found"/"blocked" are not retried.
    let outcome = await enrichFromWebsite({ website, timeoutMs: SITE_TIMEOUT_MS });
    if (outcome.status === "error") {
      await new Promise((res) => setTimeout(res, 400));
      const second = await enrichFromWebsite({ website, timeoutMs: SITE_TIMEOUT_MS });
      if (second.status !== "error") outcome = second;
    }

    const { fields, outcomes } = outcome;

    const found: Record<string, string> = {};
    for (const f of fields) {
      if (f.field === "email" && !found.email) found.email = f.value;
      if (f.field === "instagram" && !found.instagram) found.instagram = f.value;
      if (f.field === "whatsapp" && !found.whatsapp) found.whatsapp = f.value;
    }

    // Per-field state (email/instagram/whatsapp — phone stays Google-
    // authoritative). A transient error / SSRF block marks the fields
    // `failed`; a successful fetch marks them `complete` with their `has`.
    const TARGET_FIELDS: EnrichmentFieldName[] = ["email", "instagram", "whatsapp"];
    const fieldMap: EnrichmentFieldMap =
      outcome.status === "error" || outcome.status === "blocked"
        ? buildFieldMap([], TARGET_FIELDS)
        : buildFieldMap(
            outcomes
              .filter((o) => o.status === "complete" && o.field !== "phone")
              .map((o) => ({ field: o.field as EnrichmentFieldName, has: o.has })),
            [],
          );
    const enrichmentState = deriveEnrichmentState(fieldMap);

    // Additive: only fill columns currently empty; always stamp the state.
    // Multi-source (Fase 5): the website source gets its own status + TTL on
    // top of the global field map (retrocompat intact).
    const priorSources = (place.enrichment_sources as EnrichmentSourceMap | null) ?? {};
    const websiteSourceStatus =
      outcome.status === "error" || outcome.status === "blocked"
        ? ("failed" as const)
        : ("enriched" as const);
    const patch: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enrichment_status: outcome.status, // legacy free-text column, kept in sync
      enrichment_state: enrichmentState,
      enrichment_fields: fieldMap,
      enrichment_sources: {
        ...priorSources,
        website: buildSourceState(
          websiteSourceStatus,
          new Date(),
          ENRICHMENT_SOURCE_TTL_DAYS.website,
        ),
      },
    };
    // ── Descoberta de CNPJ (Fase 10) ────────────────────────────────────────
    //
    // O HTML já foi baixado acima; extrair o CNPJ dali não custa requisição
    // nenhuma. ADITIVO como todo o resto: um tax_id já existente (digitado
    // pelo usuário ou confirmado pelo registro) NUNCA é sobrescrito por um
    // palpite de rodapé.
    const priorTaxId = (place.tax_id as string | null) ?? null;
    const discoveredTaxId = priorTaxId ? null : (outcome.taxIdCandidates[0] ?? null);
    if (discoveredTaxId) patch.tax_id = discoveredTaxId;

    if (found.email && !place.email) patch.email = found.email;
    if (found.instagram && !place.instagram) patch.instagram = found.instagram;
    if (found.whatsapp && !place.whatsapp) {
      patch.whatsapp = found.whatsapp;
      // 'possible', NÃO 'verified': o número foi RASPADO do site da empresa.
      // Ninguém confirmou que existe conta de WhatsApp ativa nele. 'verified'
      // fica reservado para validação por provider externo (job type
      // WHATSAPP_VALIDATION) — hoje sem provider configurado. Marcar scrape
      // como verificado é apresentar inferência como fato: o vendedor confia,
      // manda mensagem e ela não chega.
      patch.whatsapp_status = "possible";
    }
    await admin.from("places").update(patch).eq("id", placeId);

    // searches.enriched_count (Fase 2.3): métrica lida por get-search-status e
    // pelo painel, antes NUNCA escrita. Derivada por COUNT da fonte da verdade
    // (places.enriched_at + enrichment_state) para ser idempotente — reprocessar
    // o mesmo place recomputa o mesmo número, nunca infla. A RPC cobre TODAS as
    // buscas que contêm este place (um place pode aparecer em várias).
    const { error: recountError } = await admin.rpc("recount_search_enriched_counts", {
      p_place_id: placeId,
    });
    if (recountError) {
      // Métrica defasada não pode falhar o job — o enrichment em si concluiu.
      console.warn(
        `[enrich-company] enriched_count recompute failed for ${placeId}: ${recountError.message}`,
      );
    }

    // Provenance (spec #26): record/refresh the website source of this pass.
    // Confidence grows with the number of contact fields the site answered.
    await upsertWebsiteSource(admin, {
      organizationId,
      placeId,
      found: Object.keys(found).length,
      website,
    });

    if (discoveredTaxId) {
      await upsertWebsiteCnpjSource(admin, {
        organizationId,
        placeId,
        candidates: outcome.taxIdCandidates,
        chosen: discoveredTaxId,
        website,
      });
    }

    // ── Consulta automática ao registro (Fase 11) ───────────────────────────
    //
    // Fecha a cadeia: descobriu o CNPJ → busca cadastro, QSA, pessoas e
    // decisores sem o usuário digitar nada.
    //
    // Três guardas que mantêm o volume honesto:
    //   1. só dispara com CNPJ conhecido (descoberto agora ou já persistido);
    //   2. só quando a fonte de registro está VENCIDA ou nunca foi consultada
    //      — o TTL de 90 dias é o freio real; reprocessar uma busca não
    //      reconsulta nada;
    //   3. fire-and-forget: a BrasilAPI é gratuita mas sem SLA, e nada nela
    //      pode atrasar ou derrubar o enrichment de contato, que é o que o
    //      usuário está esperando na tela.
    const taxIdForLookup = priorTaxId ?? discoveredTaxId;
    if (taxIdForLookup && isEnrichmentSourceStale(priorSources, "business_registry")) {
      const { fireAndForget: dispatchLookup } = await import("./dispatch.ts");
      dispatchLookup("lookup-cnpj", { placeId, cnpj: taxIdForLookup, organizationId });
    }

    // Fase 3 (unificação de score): o V2 é a engine canônica — em vez de
    // re-gravar o v3 legado POR CIMA do score V2, enfileira um job
    // OPPORTUNITY_SCORING novo (idempotente por chave pós-enrich) para o
    // worker re-scorear com o estado pós-enriquecimento — score-company lê o
    // place atual e sincroniza search_results + company_opportunity_scores +
    // leads.score numa operação só.
    const scoringKey = `${companyProcessingKey(organizationId, searchId, placeId)}:post-enrich`;
    await queue.enqueue({
      type: "OPPORTUNITY_SCORING",
      organizationId,
      searchId,
      companyId: placeId,
      idempotencyKey: scoringKey,
      payload: { searchId, placeId, reason: "post-enrichment" },
    });
    const { fireAndForget } = await import("./dispatch.ts");
    fireAndForget("process-jobs", {}); // single wake — worker re-scoreia o V2

    const result = { fieldsFound: Object.keys(found).length, enrichmentStatus: outcome.status };

    // Close the job: definitive answer (ok/not_found/blocked) → completed;
    // a transient fetch failure → retry classification (bounded by attempts).
    if (outcome.status === "error") {
      await stampJobMetrics(admin, jobId, enrichmentJobCost());
      await queue.fail(jobId, { status: 503, message: "website fetch failed" });
      return { placeId, found: 0, status: "error" };
    }
    await stampJobMetrics(admin, jobId, enrichmentJobCost());
    await queue.complete(jobId, result);
    return {
      placeId,
      found: Object.keys(found).length,
      status: outcome.status,
    };
  } catch (err) {
    // Unexpected local error (DB write, etc.) — classify; transient → retrying.
    await stampJobMetrics(admin, jobId, enrichmentJobCost()).catch(() => {});
    await queue.fail(jobId, err);
    return { placeId, found: 0, status: "error" };
  }
}
