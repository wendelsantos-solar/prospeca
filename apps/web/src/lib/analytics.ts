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
  | "signup_failed"
  | "sales_contact_started"
  | "sales_contact_completed"
  | "faq_opened"
  | "founder_offer_viewed"
  | "navigation_item_clicked"
  | "product_demo_viewed"
  | "map_demo_interacted"
  | "pipeline_demo_viewed"
  | "pricing_section_viewed"
  | "agency_cta_clicked"
  | "final_cta_clicked"
  | "login_clicked"
  // Auth (V2)
  | "login_page_viewed"
  | "signup_page_viewed"
  | "google_auth_started"
  | "google_auth_completed"
  | "google_auth_failed"
  | "email_login_started"
  | "email_login_completed"
  | "email_login_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "email_verification_resent"
  | "auth_callback_failed"
  | "workspace_provisioning_started"
  | "workspace_provisioning_completed"
  | "workspace_provisioning_failed"
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
  | "invitation_accept_failed"
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

  // `organization_id` é NOT NULL em usage_events: sem contexto de organização a
  // inserção falharia de qualquer forma. Não persiste, mas o console.debug acima
  // já registrou — e o aviso torna visível a perda (antes era 100% silenciosa).
  if (!context.organizationId) {
    console.debug(`[analytics] ${event} não persistido: sem organizationId no contexto`);
    return;
  }

  // Fire-and-forget. A forma do payload tem de casar EXATAMENTE com a policy
  // `usage_events_product_insert` (20260730000005): metric preenchido,
  // event_type/estimated_cost/provider nulos, quantity 1, source_type
  // 'product_event' e user_id = auth.uid(). Mudar aqui exige mudar a policy.
  try {
    const supabase = getSupabase();
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      void supabase
        .from("usage_events")
        .insert({
          organization_id: context.organizationId,
          user_id: userId,
          metric: event,
          quantity: 1,
          source_type: "product_event",
          metadata: enriched,
        })
        .then(({ error }) => {
          // Não relança: analytics nunca deve quebrar o app. Mas também não
          // engole em silêncio — foi assim que a ausência da policy de INSERT
          // passou despercebida.
          if (error) {
            console.warn(`[analytics] falha ao persistir ${event}: ${error.message}`);
          }
        });
    });
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
