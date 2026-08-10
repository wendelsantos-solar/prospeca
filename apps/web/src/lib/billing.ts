// Billing client — frontend interface to the Stripe billing edge function.
//
// Depends on STRIPE_SECRET_KEY being configured server-side.
// When billing is not configured, all operations return a friendly error
// and the UI shows appropriate "não disponível" states.
//
// See docs/BILLING_ARCHITECTURE.md for the full architecture.

import { invokeFunction } from "./supabase";

export interface CheckoutParams {
  planCode: string;
  billingInterval?: "monthly" | "annual";
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

export interface PortalResult {
  portalUrl: string;
}

/**
 * Creates a Stripe Checkout session and returns the URL to redirect to.
 * The user completes payment on Stripe's hosted page.
 * Subscription status is confirmed via webhook (never the redirect).
 */
export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const data = await invokeFunction("stripe-billing", {
    action: "create-checkout",
    planCode: params.planCode,
    billingInterval: params.billingInterval ?? "monthly",
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
  });
  return data as CheckoutResult;
}

/**
 * Creates a Stripe Customer Portal session and returns the URL.
 * The user manages their subscription, payment method, and invoices
 * on Stripe's hosted page.
 */
export async function createPortalSession(returnUrl?: string): Promise<PortalResult> {
  const data = await invokeFunction("stripe-billing", {
    action: "create-portal",
    returnUrl: returnUrl ?? `${window.location.origin}/app/configuracoes/plano`,
  });
  return data as PortalResult;
}

/**
 * Whether billing is likely configured (checks don't round-trip to server).
 * The definitive check is done server-side; this is for UI gating only.
 */
export function isBillingEnabled(): boolean {
  // We can't check server-side env from the browser, but we know billing
  // is only functional in real mode. The edge function will return a
  // BILLING_NOT_CONFIGURED error if Stripe keys are missing.
  return true; // always attempt — let the server decide
}
