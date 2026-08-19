// Feature flags — centralized gating for features that depend on external
// configuration or product decisions.
//
// Design:
//   - Flags are resolved from env vars (build-time) + API (runtime).
//   - Components never read env directly — they use these hooks/functions.
//   - Adding a flag: add it to `FeatureFlag` type, set default in `DEFAULTS`,
//     and gate your component with `useFeatureFlag()` or `<FeatureGate>`.
//
// Runtime flags (can change without redeploy) are fetched from the
// billing_plans.features JSON — these are per-plan, not global.
// Build-time flags are env vars (VITE_FEATURE_*) — these require redeploy.

import { isDemoMode } from "./env";

// ── Static (build-time) flags ─────────────────────────────────────────

export type FeatureFlag =
  | "googleAuth"
  | "billing"
  | "googleCalendar"
  | "aiMessage"
  | "realtimeSearch"
  | "bulkExport"
  | "kanbanBoard"
  | "mapView"
  | "whatsappContact"
  | "feedbackAttachments"
  // Discovery Intelligence V2 (spec #96)
  | "discoveryV2"
  | "v2ScoringInDiscovery"
  | "heatmapEnabled"
  | "territoryIntelligenceEnabled"
  | "asyncEnrichmentEnabled"
  | "cnaeIntelligenceEnabled"
  | "nextBestActionEnabled";

const STATIC_DEFAULTS: Record<FeatureFlag, boolean> = {
  googleAuth: !!import.meta.env.VITE_GOOGLE_CLIENT_ID,
  billing: true, // always attempt — server decides based on STRIPE_SECRET_KEY
  googleCalendar: true, // always attempt — server decides based on GOOGLE_CALENDAR_CLIENT_ID
  aiMessage: !!import.meta.env.VITE_ANTHROPIC_API_KEY || !!import.meta.env.VITE_AI_ENABLED,
  realtimeSearch: true,
  bulkExport: true,
  kanbanBoard: true,
  mapView: true,
  whatsappContact: true,
  feedbackAttachments: true,
  discoveryV2: true,
  v2ScoringInDiscovery: true,
  heatmapEnabled: true,
  territoryIntelligenceEnabled: true,
  asyncEnrichmentEnabled: true,
  cnaeIntelligenceEnabled: true, // BrasilAPI (gratuita, sem credencial) — D3 aprovado
  nextBestActionEnabled: true,
};

/**
 * Check if a static feature flag is enabled.
 * For runtime (per-plan) features, use entitlements instead.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (isDemoMode) {
    // In demo mode, hide features that require external configuration.
    if (["googleAuth", "billing", "googleCalendar", "aiMessage"].includes(flag)) return false;
    return STATIC_DEFAULTS[flag] ?? false;
  }
  return STATIC_DEFAULTS[flag] ?? false;
}

/**
 * Returns the list of flags and their status — useful for admin diagnostics.
 */
export function getFeatureFlagStatuses(): Array<{ name: string; enabled: boolean }> {
  return Object.entries(STATIC_DEFAULTS).map(([name, enabled]) => ({
    name,
    enabled: isFeatureEnabled(name as FeatureFlag),
  }));
}
