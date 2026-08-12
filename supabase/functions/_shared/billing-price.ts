// Picks the provider price id for a billing interval.
//
// Extracted so the choice is unit-testable: it used to live inline in
// createCheckoutSession, where a bare `billingInterval` (instead of
// `params.billingInterval`) made the whole method throw ReferenceError before
// it ever reached Stripe.

export type BillingInterval = "monthly" | "annual";

export interface PlanPriceRow {
  provider_monthly_price_id?: string | null;
  provider_annual_price_id?: string | null;
}

/** Returns the configured price id, or null when the plan has no price for that interval. */
export function pickPriceId(
  plan: PlanPriceRow | null | undefined,
  interval: BillingInterval,
): string | null {
  if (!plan) return null;
  const priceId =
    interval === "monthly" ? plan.provider_monthly_price_id : plan.provider_annual_price_id;
  return priceId ? priceId : null;
}
