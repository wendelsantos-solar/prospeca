// Billing entitlements — reads the org's plan + current usage and enforces
// them. Fase 1: built and testable, but not yet wired into create-search /
// execute-search (those still gate on the pre-existing quota.ts). Wiring
// them up is Fase 2 work, done alongside real Stripe plans.
import type { FeatureKey, UsageMetric } from "@leads/domain/entitlements";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./http.ts";

// Re-export domain types for convenience.
export type { FeatureKey, UsageMetric };

const UNLIMITED = -1;

export interface OrganizationEntitlements {
  plan: { code: string; name: string };
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: Record<FeatureKey, boolean>;
  limits: Record<UsageMetric, number>;
  usage: Partial<Record<UsageMetric, number>>;
}

export async function getEntitlements(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationEntitlements> {
  const { data, error } = await admin.rpc("get_organization_entitlements", {
    p_organization_id: organizationId,
  });
  if (error || !data) throw new AppError("INTERNAL_ERROR", "Falha ao verificar plano.");
  return data as OrganizationEntitlements;
}

export async function assertFeatureAccess(
  admin: SupabaseClient,
  organizationId: string,
  feature: FeatureKey,
) {
  const ent = await getEntitlements(admin, organizationId);
  if (ent.features[feature] !== true) {
    throw new AppError(
      "FEATURE_NOT_AVAILABLE",
      "Este recurso não está disponível no seu plano atual.",
      { feature, plan: ent.plan.code },
    );
  }
  return ent;
}

export async function assertUsageAvailable(
  admin: SupabaseClient,
  organizationId: string,
  metric: UsageMetric,
  quantity = 1,
) {
  const ent = await getEntitlements(admin, organizationId);
  const limit = ent.limits[metric];
  if (limit === UNLIMITED) return ent;
  const used = ent.usage[metric] ?? 0;
  if (used + quantity > limit) {
    throw new AppError("PLAN_LIMIT_REACHED", "Limite do plano atingido.", {
      metric,
      used,
      limit,
      plan: ent.plan.code,
    });
  }
  return ent;
}

/**
 * Records `quantity` units of `metric` consumed — writes the raw event
 * (audit trail, `usage_events`) and bumps the period counter atomically via
 * `increment_usage_counter` (upsert, no read-modify-write race). Pass an
 * `idempotencyKey` for anything that could be retried (e.g. a webhook
 * handler) so a retry never double-counts.
 */
export async function recordEntitlementUsage(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    userId?: string;
    metric: UsageMetric;
    quantity?: number;
    sourceType?: string;
    sourceId?: string;
    idempotencyKey?: string;
  },
) {
  const quantity = input.quantity ?? 1;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { error: eventError } = await admin.from("usage_events").insert({
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    metric: input.metric,
    quantity,
    source_type: input.sourceType ?? null,
    source_id: input.sourceId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  });
  // Idempotent replay: the unique index on (organization_id, idempotency_key)
  // rejects a duplicate insert — that's the retry being a no-op, not a bug.
  if (eventError && eventError.code !== "23505") {
    throw new AppError("INTERNAL_ERROR", "Falha ao registrar consumo.");
  }
  if (eventError?.code === "23505") return;

  const { error: counterError } = await admin.rpc("increment_usage_counter", {
    p_organization_id: input.organizationId,
    p_metric: input.metric,
    p_period_start: periodStart.toISOString().slice(0, 10),
    p_period_end: periodEnd.toISOString().slice(0, 10),
    p_quantity: quantity,
  });
  if (counterError) throw new AppError("INTERNAL_ERROR", "Falha ao registrar consumo.");
}
