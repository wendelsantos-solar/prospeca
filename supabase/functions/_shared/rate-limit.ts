// Rate limiting — sliding window backed by usage_events.
// Centralized so all edge functions use the same thresholds.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./http.ts";

export interface RateLimitConfig {
  /** Max operations per window (default: 60 seconds) */
  maxPerMinute: number;
  /** Event type used as the rate-limit key prefix */
  eventType: string;
  /** Window in seconds (default: 60) */
  windowSeconds?: number;
  /** Custom error message */
  message?: string;
}

const DEFAULTS: Record<string, RateLimitConfig> = {
  "create-search": { maxPerMinute: 5, eventType: "rate_limit_search" },
  "import-search-results": { maxPerMinute: 10, eventType: "rate_limit_import" },
  "enrich-discovery": { maxPerMinute: 10, eventType: "rate_limit_enrich" },
  "create-export": { maxPerMinute: 3, eventType: "rate_limit_export" },
  "submit-feedback": { maxPerMinute: 5, eventType: "rate_limit_feedback" },
  "accept-invitation": { maxPerMinute: 5, eventType: "rate_limit_invitation" },
  "submit-sales-contact": { maxPerMinute: 3, eventType: "rate_limit_sales_contact" },
  "geocode-location": { maxPerMinute: 10, eventType: "rate_limit_geocode" },
};

/**
 * Enforces a rate limit for the given operation.
 * Throws RATE_LIMIT_EXCEEDED if exceeded.
 *
 * Uses usage_events as the counter store (already indexed).
 * For higher-scale needs, swap to Redis or a token bucket.
 */
export async function assertRateLimit(
  admin: SupabaseClient,
  organizationId: string,
  operation: string,
  config?: Partial<RateLimitConfig>,
): Promise<void> {
  const defaults = DEFAULTS[operation];
  const cfg: RateLimitConfig = {
    maxPerMinute: config?.maxPerMinute ?? defaults?.maxPerMinute ?? 10,
    eventType: config?.eventType ?? defaults?.eventType ?? `rate_limit_${operation}`,
    windowSeconds: config?.windowSeconds ?? 60,
    message: config?.message,
  };

  const windowStart = new Date(Date.now() - cfg.windowSeconds! * 1000).toISOString();
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("event_type", cfg.eventType)
    .gte("created_at", windowStart);

  if (error) {
    // If we can't check, allow through (fail open for beta)
    console.warn(`Rate limit check failed for ${operation}:`, error.message);
    return;
  }

  if ((count ?? 0) >= cfg.maxPerMinute) {
    throw new AppError(
      "RATE_LIMIT_EXCEEDED",
      cfg.message ??
        `Limite de operações atingido. Tente novamente em ${cfg.windowSeconds} segundos.`,
      {
        operation,
        maxPerMinute: cfg.maxPerMinute,
        windowSeconds: cfg.windowSeconds,
        retryAfterSeconds: cfg.windowSeconds,
      },
    );
  }

  // Record this attempt for the rate limit counter
  await admin.from("usage_events").insert({
    organization_id: organizationId,
    event_type: cfg.eventType,
    quantity: 1,
  });
}
