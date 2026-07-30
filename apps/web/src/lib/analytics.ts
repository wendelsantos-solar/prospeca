// Product analytics — stub. No provider wired yet (see docs/MARKETING_SITE.md
// for the decision). `track()` is the only thing call sites touch; swapping
// the body for a real provider later (PostHog etc.) never touches a caller.
import { isRealMode } from "./env";

export type AnalyticsEvent =
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
  | "founder_offer_viewed";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (!isRealMode) return;
  console.debug(`[analytics] ${event}`, props ?? {});
}
