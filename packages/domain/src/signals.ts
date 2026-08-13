// Named Company Signals — independent, source-agnostic facts about a company.
// The ScoringEngine (opportunity-score.ts) turns signals into a score; signals
// themselves are derived/stored as-is and never scored inline. This file is the
// vocabulary shared by scoring, the UI and (future) per-org opportunity scores,
// so a signal means the same thing everywhere.

export const COMPANY_SIGNALS = [
  "NO_WEBSITE",
  "LOW_REVIEW_COUNT",
  "HIGH_RATING",
  "WEAK_REPUTATION",
  "WHATSAPP_AVAILABLE",
  "WHATSAPP_VALIDATED",
  "INSTAGRAM_WEAK",
  "BUSINESS_ACTIVE",
  "NEW_BUSINESS",
  "VALID_PHONE",
  "HAS_EMAIL",
  "HIGH_LOCAL_DENSITY",
  "LOW_DIGITAL_COMPETITION",
] as const;

export type CompanySignal = (typeof COMPANY_SIGNALS)[number];

/** Tunable thresholds. Bump alongside any scoring version change. */
export const SIGNAL_THRESHOLDS = {
  /** ≥ this rating counts as "highly rated". */
  highRatingMin: 4.0,
  /** < this rating counts as "weak reputation". */
  weakReputationMax: 3.5,
  /** < this review count counts as "low traction". */
  lowReviewCountMax: 20,
  /** ≤ this follower count counts as "weak instagram" (present but tiny). */
  instagramWeakFollowersMax: 1000,
  /** ≥ this 0..1 density counts as "high local density". */
  highLocalDensityMin: 0.7,
} as const;

export interface SignalContext {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  /** Instagram follower count. `null`/`undefined` = unknown, NOT zero. */
  instagramFollowers?: number | null;
  /** Whether the business is known to be newly opened. */
  isNewBusiness?: boolean | null;
  /** 0..1 local business density (from Territory Intelligence). */
  localDensity?: number | null;
  /** Whether the region has low digital competition. */
  lowDigitalCompetition?: boolean | null;
}

/**
 * Derive the set of observable signals. Absent data produces NO signal (we do
 * not fabricate a negative) — a missing key in `SignalContext` means "we have
 * not verified", which is distinct from "absent". This is the same rule as the
 * enrichment state machine: "não encontrado" ≠ "não existe".
 */
export function deriveSignals(ctx: SignalContext): CompanySignal[] {
  const signals: CompanySignal[] = [];

  if (ctx.businessStatus === "OPERATIONAL") signals.push("BUSINESS_ACTIVE");
  if (!ctx.hasWebsite) signals.push("NO_WEBSITE");
  if (ctx.hasValidPhone) signals.push("VALID_PHONE");

  if (ctx.whatsappStatus === "verified") signals.push("WHATSAPP_VALIDATED");
  else if (ctx.whatsappStatus === "possible") signals.push("WHATSAPP_AVAILABLE");

  if (ctx.hasEmail) signals.push("HAS_EMAIL");

  if (ctx.rating != null) {
    if (ctx.rating >= SIGNAL_THRESHOLDS.highRatingMin) signals.push("HIGH_RATING");
    if (ctx.rating < SIGNAL_THRESHOLDS.weakReputationMax) signals.push("WEAK_REPUTATION");
  }

  if (ctx.reviewCount != null && ctx.reviewCount < SIGNAL_THRESHOLDS.lowReviewCountMax) {
    signals.push("LOW_REVIEW_COUNT");
  }

  if (
    ctx.instagramFollowers != null &&
    ctx.instagramFollowers > 0 &&
    ctx.instagramFollowers <= SIGNAL_THRESHOLDS.instagramWeakFollowersMax
  ) {
    signals.push("INSTAGRAM_WEAK");
  }

  if (ctx.isNewBusiness === true) signals.push("NEW_BUSINESS");

  if (ctx.localDensity != null && ctx.localDensity >= SIGNAL_THRESHOLDS.highLocalDensityMin) {
    signals.push("HIGH_LOCAL_DENSITY");
  }

  if (ctx.lowDigitalCompetition === true) signals.push("LOW_DIGITAL_COMPETITION");

  return signals;
}

export function hasSignal(signals: CompanySignal[], signal: CompanySignal): boolean {
  return signals.includes(signal);
}
