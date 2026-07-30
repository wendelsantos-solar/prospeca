// Billing entitlements — pure logic over an already-loaded plan snapshot.
// Duplicated (FeatureKey union only) at supabase/functions/_shared/entitlements.ts
// — Deno can't import this package — keep both lists in sync.
//
// `limits` values use -1 to mean "unlimited/custom" (the `team` plan, and
// message templates on plans where they're not capped).

export const FEATURE_KEYS = [
  "lead_search",
  "advanced_filters",
  "pipeline",
  "saved_searches",
  "search_monitoring",
  "csv_export",
  "xlsx_export",
  "message_templates",
  "cadences",
  "automations",
  "advanced_analytics",
  "team_management",
  "custom_permissions",
  "api_access",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const USAGE_METRICS = [
  "users",
  "searchesPerMonth",
  "processedLeadsPerMonth",
  "savedSearches",
  "activeMonitors",
  "pipelines",
  "messageTemplates",
  "exportRowsPerMonth",
] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export interface PlanEntitlements {
  features: Record<FeatureKey, boolean>;
  limits: Record<UsageMetric, number>;
}

const UNLIMITED = -1;

export function hasFeature(entitlements: PlanEntitlements, feature: FeatureKey): boolean {
  return entitlements.features[feature] === true;
}

/** How many units of `metric` remain this period, given current usage. `null` means unlimited. */
export function remaining(
  entitlements: PlanEntitlements,
  usage: Partial<Record<UsageMetric, number>>,
  metric: UsageMetric,
): number | null {
  const limit = entitlements.limits[metric];
  if (limit === UNLIMITED) return null;
  const used = usage[metric] ?? 0;
  return Math.max(0, limit - used);
}

/** Whether `quantity` more units of `metric` fit within the plan's limit. */
export function canConsume(
  entitlements: PlanEntitlements,
  usage: Partial<Record<UsageMetric, number>>,
  metric: UsageMetric,
  quantity = 1,
): boolean {
  const left = remaining(entitlements, usage, metric);
  return left === null || left >= quantity;
}

export function isUnlimited(entitlements: PlanEntitlements, metric: UsageMetric): boolean {
  return entitlements.limits[metric] === UNLIMITED;
}
