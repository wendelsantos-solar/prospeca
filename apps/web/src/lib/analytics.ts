// Product analytics — tracks user behavior events for activation, engagement,
// and retention metrics. Events are persisted to usage_events (server-side)
// and can be forwarded to PostHog or similar when configured.
//
// `track()` is the only thing call sites touch; swapping the provider later
// never touches a caller.
import { isRealMode } from "./env";
import { getSupabase } from "./supabase";

export type AnalyticsEvent =
  // Acquisition
  | "landing_viewed"
  | "hero_cta_clicked"
  | "demo_clicked"
  | "pricing_viewed"
  | "plan_selected"
  | "signup_started"
  | "signup_completed"
  | "sales_contact_started"
  | "sales_contact_completed"
  | "faq_opened"
  | "founder_offer_viewed"
  // Onboarding
  | "onboarding_started"
  | "business_profile_completed"
  | "first_search_started"
  | "first_search_completed"
  | "first_lead_viewed"
  | "first_lead_added_to_pipeline"
  | "first_message_prepared"
  | "onboarding_completed"
  | "onboarding_skipped"
  // Engagement
  | "search_completed"
  | "lead_viewed"
  | "lead_added_to_pipeline"
  | "lead_stage_changed"
  | "message_prepared"
  | "activity_created"
  | "activity_completed"
  | "export_completed"
  // Retention & monetization
  | "user_returned"
  | "usage_limit_reached"
  | "plan_upgrade_started"
  | "feedback_submitted"
  | "invitation_accepted"
  | "account_created"
  | "organization_created";

interface TrackContext {
  organizationId?: string;
  plan?: string;
  source?: string;
}

let context: TrackContext = {};

/** Set analytics context for the current session. */
export function setAnalyticsContext(ctx: Partial<TrackContext>): void {
  context = { ...context, ...ctx };
}

/**
 * Track a product event. In real mode, persists to usage_events
 * and logs to console. In demo mode, only logs.
 */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  const enriched = {
    ...props,
    organization_id: context.organizationId,
    plan: context.plan,
    source: context.source,
    timestamp: new Date().toISOString(),
  };

  if (!isRealMode) {
    console.debug(`[analytics] ${event}`, enriched);
    return;
  }

  console.debug(`[analytics] ${event}`, enriched);

  // Fire-and-forget persistence to usage_events
  try {
    const supabase = getSupabase();
    supabase
      .from("usage_events")
      .insert({
        organization_id: context.organizationId ?? null,
        metric: event,
        quantity: 1,
        source_type: "product_event",
        metadata: enriched,
      })
      .then(
        () => {},
        () => {}, // Silently ignore persistence errors
      );
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Track a navigation event (page view).
 */
export function trackPageView(page: string): void {
  if (!isRealMode) return;
  console.debug(`[analytics] page_view: ${page}`);
}
