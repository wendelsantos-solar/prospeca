// Opportunity Score — multi-component, explainable, versioned.
//
// This is the V2 scoring engine. It is kept SEPARATE from the legacy single-formula
// score.ts (v3.0.0), which remains the active `leads.score` engine until Fase 6
// migrates scoring over. The key differences:
//   - multi-component (digital gap, contactability, reputation, business quality,
//     intent match, territory, freshness) instead of one flat formula;
//   - a confidence value (how much of the input was actually observed);
//   - per-org inputs (intentMatch / territory) so the same company can score
//     differently per organization without baking org identity into the company.
//
// A Company's intrinsic quality belongs in a separate global_quality_score; this
// module computes the *opportunity* for a given organization.

import type { CompanySignal } from "./signals.ts";
import { temperatureFromScore } from "./score.ts";
import type { EnrichmentState } from "./enrichment-state.ts";

export const OPPORTUNITY_SCORE_VERSION = "v1.2.0";

// ── Score progression state (V3-C) ─────────────────────────────────────────
//
// Named, honest stages of the score's own lifecycle:
//   - ANALISANDO: the automatic source (website) has not finished yet;
//   - PARCIAL:   the pipeline ran but a consulted source failed;
//   - FINALIZADO: the automatic source finished and any consulted registry
//                 source is fine. The registry is ON-DEMAND — its absence
//                 never blocks FINALIZADO.

export const OPPORTUNITY_SCORE_STATES = ["ANALISANDO", "PARCIAL", "FINALIZADO"] as const;
export type OpportunityScoreState = (typeof OPPORTUNITY_SCORE_STATES)[number];

export interface ScoreStateInput {
  /** enrichment_sources.website.status */
  websiteState?: EnrichmentState | null;
  /** enrichment_sources.business_registry.status */
  registryState?: EnrichmentState | null;
}

export function deriveOpportunityScoreState(input: ScoreStateInput): OpportunityScoreState {
  const website = input.websiteState ?? null;
  const registry = input.registryState ?? null;
  if (website === "failed") return "PARCIAL"; // automatic source errored
  if (website !== "enriched" && website !== "partial") return "ANALISANDO";
  if (registry === "failed") return "PARCIAL"; // consulted source errored
  return "FINALIZADO";
}

// ── Confidence bands ────────────────────────────────────────────────────────
//
// LOW < 0.70 · MEDIUM 0.70–0.84 · HIGH ≥ 0.85. Bands are part of the scoring
// contract (persisted in the breakdown) — bump OPPORTUNITY_SCORE_VERSION when
// they change. Today computeConfidence floors at 0.6, so LOW only appears for
// the least-observed inputs until multi-source enrichment widens the range.

export const CONFIDENCE_BANDS = {
  /** confidence < this = LOW. */
  lowMax: 0.7,
  /** confidence >= this = HIGH; [lowMax, highMin) = MEDIUM. */
  highMin: 0.85,
} as const;

export type ConfidenceBand = "low" | "medium" | "high";

export function confidenceBandFromConfidence(confidence: number): ConfidenceBand {
  if (confidence < CONFIDENCE_BANDS.lowMax) return "low";
  if (confidence < CONFIDENCE_BANDS.highMin) return "medium";
  return "high";
}

/** Weights are part of the scoring contract — bump the version when they change. */
export const OPPORTUNITY_SCORE_WEIGHTS = {
  digital_gap: 0.3,
  contactability: 0.2,
  reputation: 0.15,
  business_quality: 0.15,
  intent_match: 0.1,
  territory: 0.05,
  freshness: 0.05,
} as const;

export type OpportunityScoreComponentKey = keyof typeof OPPORTUNITY_SCORE_WEIGHTS;

export interface OpportunityScoreInput {
  signals: CompanySignal[];
  rating: number | null;
  reviewCount: number | null;
  hasWebsite: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  /** 0..1 per-org intent match (how well the company matches the search mission). */
  intentMatch?: number | null;
  /** 0..1 territory favorability (from Territory Intelligence). */
  territoryFavorability?: number | null;
  /** Data freshness in days since last enrichment (absent = unknown). */
  freshnessDays?: number | null;
  /** Source states for the score progression state (V3-C). */
  websiteState?: EnrichmentState | null;
  registryState?: EnrichmentState | null;
}

export interface OpportunityScoreComponent {
  key: OpportunityScoreComponentKey;
  label: string;
  score: number; // 0..100 within the component
  weight: number; // 0..1 share of the total
  points: number; // weighted contribution (score * weight), rounded
  reason: string;
}

export interface OpportunityScoreBreakdown {
  version: string;
  total: number; // 0..100
  confidence: number; // 0..1
  /** LOW/MEDIUM/HIGH band of `confidence` — part of the persisted contract. */
  confidenceBand: ConfidenceBand;
  /** ANALISANDO/PARCIAL/FINALIZADO — the score's own lifecycle (V3-C). */
  scoreState: OpportunityScoreState;
  components: OpportunityScoreComponent[];
}

const has = (signals: CompanySignal[], s: CompanySignal) => signals.includes(s);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (n: number) => Math.max(0, Math.min(1, n));

function digitalGapScore(input: OpportunityScoreInput): number {
  let score = 0;
  if (!input.hasWebsite) score += 60;
  if (has(input.signals, "INSTAGRAM_WEAK")) score += 20;
  if (has(input.signals, "LOW_REVIEW_COUNT")) score += 20;
  return clamp(score || 10); // full digital maturity = low opportunity here
}

function contactabilityScore(input: OpportunityScoreInput): number {
  let score = 0;
  if (has(input.signals, "VALID_PHONE")) score += 35;
  if (has(input.signals, "WHATSAPP_VALIDATED")) score += 40;
  else if (has(input.signals, "WHATSAPP_AVAILABLE")) score += 30;
  if (has(input.signals, "HAS_EMAIL")) score += 20;
  return clamp(score);
}

function reputationScore(input: OpportunityScoreInput): number {
  if (input.rating == null) return 50; // unknown — neutral
  if (has(input.signals, "HIGH_RATING")) return 90;
  if (has(input.signals, "WEAK_REPUTATION")) return 25;
  return 60; // mid rating
}

function businessQualityScore(input: OpportunityScoreInput): number {
  let score = 50;
  if (has(input.signals, "BUSINESS_ACTIVE")) score += 25;
  if (has(input.signals, "NEW_BUSINESS")) score += 10;
  if (input.reviewCount != null && input.reviewCount >= 20) score += 15;
  return clamp(score);
}

function intentMatchScore(input: OpportunityScoreInput): number {
  return input.intentMatch == null ? 50 : clamp(pct(input.intentMatch) * 100);
}

function territoryScore(input: OpportunityScoreInput): number {
  return input.territoryFavorability == null ? 50 : clamp(pct(input.territoryFavorability) * 100);
}

function freshnessScore(input: OpportunityScoreInput): number {
  if (input.freshnessDays == null) return 50;
  if (input.freshnessDays <= 3) return 100;
  if (input.freshnessDays <= 7) return 85;
  if (input.freshnessDays <= 30) return 60;
  return 30;
}

function buildComponent(
  key: OpportunityScoreComponentKey,
  label: string,
  score: number,
  reason: string,
): OpportunityScoreComponent {
  const weight = OPPORTUNITY_SCORE_WEIGHTS[key];
  return { key, label, score, weight, points: Math.round(score * weight), reason };
}

function computeConfidence(input: OpportunityScoreInput): number {
  // Basic discovery always observes website/phone/whatsapp/category (floor 0.6).
  // Each additional observed dimension nudges confidence up; missing data never
  // blocks a score, it just lowers confidence.
  const observed = [
    input.rating != null,
    input.reviewCount != null,
    input.intentMatch != null,
    input.territoryFavorability != null,
    input.freshnessDays != null,
  ].filter(Boolean).length;
  const confidence = 0.6 + observed * 0.08;
  return Math.round(Math.min(1, confidence) * 100) / 100;
}

export function calculateOpportunityScore(input: OpportunityScoreInput): OpportunityScoreBreakdown {
  const components: OpportunityScoreComponent[] = [
    buildComponent(
      "digital_gap",
      "Lacuna digital",
      digitalGapScore(input),
      input.hasWebsite ? "Já tem site" : "Sem site próprio",
    ),
    buildComponent(
      "contactability",
      "Contatabilidade",
      contactabilityScore(input),
      "Canais de contato direto disponíveis",
    ),
    buildComponent(
      "reputation",
      "Reputação",
      reputationScore(input),
      input.rating == null ? "Avaliações não verificadas" : `Nota ${input.rating}`,
    ),
    buildComponent(
      "business_quality",
      "Qualidade do negócio",
      businessQualityScore(input),
      "Sinais de negócio ativo e consolidado",
    ),
    buildComponent(
      "intent_match",
      "Aderência à missão",
      intentMatchScore(input),
      input.intentMatch == null ? "Aderência não avaliada" : "Aderência à missão de busca",
    ),
    buildComponent(
      "territory",
      "Território",
      territoryScore(input),
      input.territoryFavorability == null ? "Território não avaliado" : "Favorabilidade territorial",
    ),
    buildComponent(
      "freshness",
      "Atualidade",
      freshnessScore(input),
      input.freshnessDays == null ? "Atualidade desconhecida" : `Dados de há ${input.freshnessDays}d`,
    ),
  ];

  const total = clamp(components.reduce((sum, c) => sum + c.points, 0));
  const confidence = computeConfidence(input);
  return {
    version: OPPORTUNITY_SCORE_VERSION,
    total,
    confidence,
    confidenceBand: confidenceBandFromConfidence(confidence),
    scoreState: deriveOpportunityScoreState({
      websiteState: input.websiteState,
      registryState: input.registryState,
    }),
    components,
  };
}

/** Reuses the canonical temperature bands (hot ≥75 / warm ≥45 / cold <45). */
export function opportunityTemperatureFromScore(score: number) {
  return temperatureFromScore(score);
}
