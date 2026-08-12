// Billing provider contracts — vendor-neutral.
// The rest of the codebase depends on this interface, never on Stripe directly.

/** Subscription status as known by the billing system. */
export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "incomplete"
  | "expired"
  | "paused";

/** Result of a checkout session creation. */
export interface CheckoutResult {
  /** URL the user should be redirected to for payment. */
  checkoutUrl: string;
  /** Provider-side session ID (for idempotency / reconciliation). */
  sessionId: string;
}

/** Result of a customer portal session creation. */
export interface PortalResult {
  /** URL the user should be redirected to for self-service. */
  portalUrl: string;
}

/** Webhook event received from the billing provider. */
export interface BillingWebhookEvent {
  /** Provider-specific event type (e.g. "checkout.session.completed"). */
  type: string;
  /** Unique event ID from the provider (for idempotency). */
  providerEventId: string;
  /** Raw payload (provider format). */
  payload: unknown;
}

/** Outcome of processing a webhook event. */
export type WebhookProcessResult =
  | { status: "ok" }
  | { status: "ignored"; reason: string }
  | { status: "error"; message: string };

/** Customer info from the billing provider. */
export interface BillingCustomer {
  provider: string;
  providerCustomerId: string;
  billingEmail: string | null;
}

/**
 * Vendor-neutral billing provider interface.
 * Implementations: StripeBillingProvider (real), NoopBillingProvider (dev/off).
 */
export interface BillingProvider {
  /** Create a checkout session for a plan upgrade/purchase. */
  createCheckoutSession(params: {
    organizationId: string;
    organizationName: string;
    customerEmail: string;
    planCode: string;
    billingInterval: "monthly" | "annual";
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult>;

  /** Create a customer portal session for self-service. */
  createPortalSession(params: { organizationId: string; returnUrl: string }): Promise<PortalResult>;

  /** Process a webhook event from the provider. */
  processWebhookEvent(event: BillingWebhookEvent): Promise<WebhookProcessResult>;

  /**
   * Verify webhook signature to prevent forgery.
   *
   * Async because HMAC verification goes through Web Crypto (`crypto.subtle`),
   * which has no synchronous form. Implementations MUST fail closed: return
   * false when the signing secret is absent, the header is unparseable, the
   * timestamp is outside the replay window, or the MAC does not match.
   */
  verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;

  /** Get the customer ID for an organization (null if not created yet). */
  getCustomerId(organizationId: string): Promise<string | null>;

  /** Whether billing is enabled (credentials configured). */
  isEnabled(): boolean;
}

/** Plans that can be purchased via the billing provider. */
export interface BillablePlan {
  code: string;
  name: string;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  /** Provider price IDs — must match what's configured in Stripe dashboard. */
  providerMonthlyPriceId: string | null;
  providerAnnualPriceId: string | null;
}
