// Rate limiting antiabuso — janela deslizante sobre `rate_limit_events`.
//
// ATENÇÃO — existem DUAS abstrações de rate limit neste projeto, de propósito:
//
//   _shared/quota.ts  → assertRateLimit(admin, orgId, eventType, maxPerMinute)
//     Conta eventos de CUSTO reais já gravados em `usage_events` por
//     recordUsage(). Serve para throttle de operações faturáveis
//     (create-search, enrich-*, geocode, export). Não grava nada.
//
//   este arquivo       → assertRateLimit(admin, scope, operation, cfg?)
//     Contador próprio, para operações NÃO faturáveis que precisam de proteção
//     antiabuso (aceitar convite, enviar feedback, criar piloto). Grava o
//     próprio evento em `rate_limit_events`.
//
// Não unificar as duas sem decidir o que fazer com a base de custo: gravar
// eventos de throttle em `usage_events` contamina quota e billing.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./http.ts";

export interface RateLimitConfig {
  /** Máximo de operações na janela */
  maxPerMinute: number;
  /** Tamanho da janela em segundos (default: 60) */
  windowSeconds?: number;
  /** Mensagem de erro customizada */
  message?: string;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  "accept-invitation": { maxPerMinute: 10 },
  "create-pilot": { maxPerMinute: 5 },
  "submit-feedback": { maxPerMinute: 5 },
  "submit-sales-contact": { maxPerMinute: 3 },
};

/**
 * Escopo do contador. Opaco e sem FK — precisa funcionar antes de existir
 * organização resolvida (ex.: aceitar convite).
 *
 * Use `byUser` sempre que houver sessão autenticada: escopo por organização
 * deixa um membro esgotar a cota dos outros, e escopo global deixa qualquer
 * chamador negar serviço a todos (foi o bug do zero-UUID em accept-invitation).
 */
export const scope = {
  byUser: (userId: string) => `user:${userId}`,
  byOrganization: (organizationId: string) => `org:${organizationId}`,
  /** Para fluxos sem sessão. `emailHash` deve ser SHA-256, nunca o e-mail cru. */
  byEmailHash: (emailHash: string) => `email:${emailHash}`,
};

/**
 * Aplica rate limit para a operação no escopo dado.
 * Lança RATE_LIMIT_EXCEEDED se estourar.
 *
 * Fail-open: se a checagem falhar (banco indisponível), a requisição passa —
 * decisão consciente para o beta, porque negar acesso por indisponibilidade do
 * contador é pior que deixar passar uma operação não faturável. O erro é
 * logado como `rate_limit_degraded` para ser visível. Reavaliar antes de abrir
 * cadastro público (ver docs/SECURITY_AUDIT.md).
 */
export async function assertRateLimit(
  admin: SupabaseClient,
  scopeKey: string,
  operation: string,
  config?: Partial<RateLimitConfig>,
): Promise<void> {
  const defaults = DEFAULTS[operation];
  const maxPerMinute = config?.maxPerMinute ?? defaults?.maxPerMinute ?? 10;
  const windowSeconds = config?.windowSeconds ?? defaults?.windowSeconds ?? 60;

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("scope_key", scopeKey)
    .eq("operation", operation)
    .gte("created_at", windowStart);

  if (error) {
    // Fail-open, mas visível: sem este log o limitador pode ficar inerte sem
    // ninguém perceber (exatamente o que aconteceu com o CHECK de usage_events).
    console.error(
      JSON.stringify({
        level: "error",
        event: "rate_limit_degraded",
        phase: "count",
        operation,
        errorCode: error.code,
        message: error.message,
      }),
    );
    return;
  }

  if ((count ?? 0) >= maxPerMinute) {
    throw new AppError(
      "RATE_LIMIT_EXCEEDED",
      config?.message ??
        defaults?.message ??
        `Limite de operações atingido. Tente novamente em ${windowSeconds} segundos.`,
      { operation, maxPerMinute, windowSeconds, retryAfterSeconds: windowSeconds },
    );
  }

  // Registra a tentativa. O erro É verificado: um INSERT que falha em silêncio
  // torna o limitador inerte (count fica sempre 0).
  const { error: insertError } = await admin
    .from("rate_limit_events")
    .insert({ scope_key: scopeKey, operation });

  if (insertError) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "rate_limit_degraded",
        phase: "insert",
        operation,
        errorCode: insertError.code,
        message: insertError.message,
      }),
    );
  }
}
