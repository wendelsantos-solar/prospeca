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

// ── Severity + evidence (spec #60: sinais com severidade/evidência/confiança/
//    origem/data) ────────────────────────────────────────────────────────────
//
// Severity rates how strong the signal is as an OPPORTUNITY indicator (a gap
// the seller can act on), not how "good" the fact is for the company.
// Evidence strings are honest and specific — derived only from observed data
// (the same rule as deriveSignals: absent ≠ false, never invent).

export type SignalSeverity = "high" | "medium" | "low";

/** Where the underlying data came from. */
export type SignalSource = "google_places" | "website" | "derived";

const SIGNAL_SEVERITY: Record<CompanySignal, SignalSeverity> = {
  NO_WEBSITE: "high",
  WEAK_REPUTATION: "high",
  LOW_REVIEW_COUNT: "medium",
  INSTAGRAM_WEAK: "medium",
  WHATSAPP_AVAILABLE: "medium",
  NEW_BUSINESS: "medium",
  HIGH_LOCAL_DENSITY: "medium",
  LOW_DIGITAL_COMPETITION: "medium",
  HIGH_RATING: "low",
  BUSINESS_ACTIVE: "low",
  VALID_PHONE: "low",
  HAS_EMAIL: "low",
  WHATSAPP_VALIDATED: "low",
};

export function signalSeverity(signal: CompanySignal): SignalSeverity {
  return SIGNAL_SEVERITY[signal];
}

export interface SignalEvidence {
  signal: CompanySignal;
  severity: SignalSeverity;
  /** Honest, specific, human-readable reason (pt-BR). */
  evidence: string;
  /** 0..1 — how much the underlying data supports this signal. */
  confidence: number;
  /** Where the underlying data came from. */
  source: SignalSource;
  /** ISO timestamp of derivation. */
  derivedAt: string;
}

/** Defensive fallback for a signal present in the list but whose supporting
 * data is absent in the context — honest: low confidence, generic wording. */
function weakEvidence(signal: CompanySignal, derivedAt: string): SignalEvidence {
  return {
    signal,
    severity: signalSeverity(signal),
    evidence: "dado de origem não disponível",
    confidence: 0.3,
    source: "derived",
    derivedAt,
  };
}

/**
 * Build the evidence array for a list of derived signals. `ctx` must be the
 * SAME context that produced the signals (deriveSignals), so each signal's
 * supporting data is present; when it is not (defensive), the entry gets low
 * confidence instead of fabricated wording. Empty input → empty output.
 */
export function buildSignalEvidence(
  signals: CompanySignal[],
  ctx: SignalContext,
  derivedAt: Date = new Date(),
): SignalEvidence[] {
  const at = derivedAt.toISOString();
  const out: SignalEvidence[] = [];

  for (const signal of signals) {
    switch (signal) {
      case "NO_WEBSITE":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "sem site próprio identificado nos dados de descoberta",
          confidence: 0.9,
          source: "google_places",
          derivedAt: at,
        });
        break;
      case "LOW_REVIEW_COUNT":
        out.push(
          ctx.reviewCount != null
            ? {
                signal,
                severity: signalSeverity(signal),
                evidence: `poucas avaliações (${ctx.reviewCount})`,
                confidence: 1,
                source: "google_places",
                derivedAt: at,
              }
            : weakEvidence(signal, at),
        );
        break;
      case "HIGH_RATING":
        out.push(
          ctx.rating != null
            ? {
                signal,
                severity: signalSeverity(signal),
                evidence: `nota ${ctx.rating.toFixed(1)}${
                  ctx.reviewCount != null ? ` com ${ctx.reviewCount} avaliações` : ""
                }`,
                confidence: 1,
                source: "google_places",
                derivedAt: at,
              }
            : weakEvidence(signal, at),
        );
        break;
      case "WEAK_REPUTATION":
        out.push(
          ctx.rating != null
            ? {
                signal,
                severity: signalSeverity(signal),
                evidence: `nota ${ctx.rating.toFixed(1)}${
                  ctx.reviewCount != null ? ` com ${ctx.reviewCount} avaliações` : ""
                }`,
                confidence: 1,
                source: "google_places",
                derivedAt: at,
              }
            : weakEvidence(signal, at),
        );
        break;
      case "WHATSAPP_AVAILABLE":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "número móvel identificado — WhatsApp provável, não confirmado",
          confidence: 0.6,
          source: "google_places",
          derivedAt: at,
        });
        break;
      case "WHATSAPP_VALIDATED":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "WhatsApp confirmado no site da empresa",
          confidence: 0.9,
          source: "website",
          derivedAt: at,
        });
        break;
      case "INSTAGRAM_WEAK":
        out.push(
          ctx.instagramFollowers != null
            ? {
                signal,
                severity: signalSeverity(signal),
                evidence: `Instagram com poucos seguidores (${ctx.instagramFollowers})`,
                confidence: 0.7,
                source: "website",
                derivedAt: at,
              }
            : weakEvidence(signal, at),
        );
        break;
      case "BUSINESS_ACTIVE":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "negócio operacional segundo o Google",
          confidence: 1,
          source: "google_places",
          derivedAt: at,
        });
        break;
      case "NEW_BUSINESS":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "abertura recente identificada",
          confidence: 0.5,
          source: "google_places",
          derivedAt: at,
        });
        break;
      case "VALID_PHONE":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "telefone válido (E.164) nos dados de descoberta",
          confidence: 1,
          source: "google_places",
          derivedAt: at,
        });
        break;
      case "HAS_EMAIL":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "e-mail encontrado no site da empresa",
          confidence: 0.9,
          source: "website",
          derivedAt: at,
        });
        break;
      case "HIGH_LOCAL_DENSITY":
        out.push(
          ctx.localDensity != null
            ? {
                signal,
                severity: signalSeverity(signal),
                evidence: `alta densidade de empresas na região (${ctx.localDensity.toFixed(2)})`,
                confidence: 0.6,
                source: "derived",
                derivedAt: at,
              }
            : weakEvidence(signal, at),
        );
        break;
      case "LOW_DIGITAL_COMPETITION":
        out.push({
          signal,
          severity: signalSeverity(signal),
          evidence: "baixa concorrência digital na região",
          confidence: 0.6,
          source: "derived",
          derivedAt: at,
        });
        break;
      default:
        out.push(weakEvidence(signal, at));
    }
  }

  return out;
}
