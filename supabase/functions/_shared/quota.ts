import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError, logEvent } from "./http.ts";
import { captureError } from "./error-tracking.ts";

export interface QuotaStatus {
  searchLimit: number;
  searchUsed: number;
  placeLimit: number;
  placeUsed: number;
}

export async function getQuotaStatus(
  admin: SupabaseClient,
  organizationId: string,
): Promise<QuotaStatus> {
  const { data, error } = await admin.rpc("get_quota_status", {
    p_organization_id: organizationId,
  });
  if (error || !data) throw new AppError("INTERNAL_ERROR", "Falha ao verificar quota.");
  return data as QuotaStatus;
}

export async function assertSearchQuota(admin: SupabaseClient, organizationId: string) {
  const q = await getQuotaStatus(admin, organizationId);
  if (q.searchUsed >= q.searchLimit) {
    throw new AppError("PLAN_LIMIT_REACHED", "Limite mensal de buscas atingido.", {
      used: q.searchUsed,
      limit: q.searchLimit,
    });
  }
  if (q.placeUsed >= q.placeLimit) {
    throw new AppError("PLAN_LIMIT_REACHED", "Limite mensal de resultados atingido.", {
      used: q.placeUsed,
      limit: q.placeLimit,
    });
  }
  return q;
}

export async function recordUsage(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId?: string;
    eventType: string;
    provider?: string;
    quantity?: number;
    metadata?: Record<string, unknown>;
    /** Fase 7: custo estimado pela tabela do domínio (NULL = desconhecido). */
    estimatedCostUsd?: number | null;
    /** Custo REAL reportado pelo provider (NULL = não reportado). */
    realCostUsd?: number | null;
    /** Origem do custo — NUNCA misturar medido com estimado sem discriminar. */
    costSource?: "measured" | "estimated" | null;
    /** cache hit = zero COMPROVADO; miss/false = chamada paga; null = n/a. */
    cacheHit?: boolean | null;
  },
) {
  const { error } = await admin.from("usage_events").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    provider: input.provider ?? null,
    quantity: input.quantity ?? 1,
    metadata: input.metadata ?? null,
    estimated_cost: input.estimatedCostUsd ?? null,
    real_cost_usd: input.realCostUsd ?? null,
    cost_source: input.costSource ?? null,
    cache_hit: input.cacheHit ?? null,
  });
  // Fase 7: uso é dado de BILLING — falha de gravação NUNCA é silenciosa
  // (antes o erro era ignorado e o contador de rate limit ficava em 0 sem
  // ninguém saber).
  if (error) throw new Error(`recordUsage(${input.eventType}): ${error.message}`);
}

/**
 * Registro de uso PÓS-TRABALHO PAGO (Google Places etc.) — a chamada ao
 * provider JÁ aconteceu e o dinheiro JÁ foi gasto. Falha de telemetria NÃO
 * pode derrubar a resposta nem induzir retry (retry = DOUBLE-SPEND — o P1-2
 * do Motor). Fora de banda: log estruturado + captureError; a operação real
 * retorna sucesso. Use `recordUsage` (fail-closed) quando o registro acontece
 * ANTES do trabalho pago ou quando o contador alimenta um rate limit que
 * protege o trabalho (ai_message_generate, cnpj_lookup, enrich_request).
 */
export async function recordPaidUsage(
  admin: SupabaseClient,
  input: Parameters<typeof recordUsage>[1],
): Promise<void> {
  try {
    await recordUsage(admin, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      operation: `recordUsage:${input.eventType}`,
      status: "error",
      errorCode: "USAGE_RECORD_FAILED",
      error: message,
    });
    captureError(err, {
      location: `recordUsage:${input.eventType}`,
      organizationId: input.organizationId,
    });
  }
}

/**
 * Simple sliding-window rate limit backed by usage_events.
 * Throws RATE_LIMIT_EXCEEDED when the caller exceeded maxPerMinute.
 *
 * ⚠️ ATENÇÃO — existem DOIS `assertRateLimit` neste projeto (NÃO unificados de
 * propósito, risco alto/pouco retorno — Fase 7):
 *
 *   1. ESTE (quota.ts): assertRateLimit(admin, organizationId, eventType,
 *      maxPerMinute) — janela de 60s contando `usage_events` por event_type.
 *      SÓ funciona se ALGUÉM chama recordUsage com o MESMO event_type.
 *   2. _shared/rate-limit.ts: assertRateLimit(admin, scope, operation, cfg) —
 *      contador próprio sobre `rate_limit_events` (grava o próprio evento).
 *
 *   Usuários de (2): accept-invitation, submit-feedback.
 *   Usuários de (1): todos os demais (create-export, create-search,
 *   enrich-*, generate-contact-message, lookup-cnpj, geocode-location...).
 *   NÃO troque um pelo outro achando que limitou — os contadores são
 *   tabelas diferentes.
 */
export async function assertRateLimit(
  admin: SupabaseClient,
  organizationId: string,
  eventType: string,
  maxPerMinute: number,
) {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("event_type", eventType)
    .gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= maxPerMinute) {
    throw new AppError("RATE_LIMIT_EXCEEDED", "Limite temporário atingido.", {
      retryAfterSeconds: 30,
    });
  }
}

export async function writeAudit(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await admin.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}
