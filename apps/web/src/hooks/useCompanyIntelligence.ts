import { useMemo } from "react";
import {
  buildSignalEvidence,
  calculateOpportunityScore,
  deriveOpportunityScoreState,
  deriveSignals,
  opportunityTemperatureFromScore,
  recommendNextBestAction,
  signalSeverity,
  type OpportunityScoreBreakdown,
  type SignalEvidence,
  type NextBestAction,
} from "@leads/domain";
import type { DisplayLead, Lead } from "@/types";
import { useOpportunityScore } from "@/hooks/useLeadsQuery";

/** Normalize a persisted evidence array into the typed domain shape. Honest:
 * only well-formed entries are kept — malformed rows fall back to client calc. */
export function asSignalEvidence(raw: unknown): SignalEvidence[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SignalEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Partial<SignalEvidence>;
    if (typeof e.signal !== "string" || typeof e.evidence !== "string") continue;
    out.push({
      signal: e.signal as SignalEvidence["signal"],
      severity:
        e.severity === "high" || e.severity === "medium" || e.severity === "low"
          ? e.severity
          : signalSeverity(e.signal as SignalEvidence["signal"]),
      evidence: e.evidence,
      confidence: typeof e.confidence === "number" ? e.confidence : 0.5,
      source: e.source ?? "derived",
      derivedAt: e.derivedAt ?? "",
    });
  }
  return out;
}

/** Normalize a persisted breakdown row into the typed domain shape. Honest:
 * only fields actually present in the stored JSON are used. */
export function asBreakdown(raw: unknown): OpportunityScoreBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<OpportunityScoreBreakdown>;
  if (
    typeof b.total !== "number" ||
    typeof b.confidence !== "number" ||
    !Array.isArray(b.components)
  ) {
    return null;
  }
  return b as OpportunityScoreBreakdown;
}

export interface CompanyIntelligence {
  /** Score total + 7 weighted components (V2 opportunity score). */
  score: OpportunityScoreBreakdown;
  temperature: "hot" | "warm" | "cold";
  scoreState: "ANALISANDO" | "PARCIAL" | "FINALIZADO";
  /** Named signals with severity/confidence/source — persisted when available,
   * client-derived otherwise (same deterministic domain rule). */
  evidence: SignalEvidence[];
  nba: NextBestAction;
  version: string | null;
}

/**
 * Company intelligence de UM lead — score V2 explicável, sinais nomeados e
 * próxima melhor ação, calculados UMA vez e compartilhados entre
 * CompanyIntelligenceCard (aba Oportunidade) e o card Reputação (Visão geral)
 * sem duplicar chamadas de domínio.
 */
export function useCompanyIntelligence(lead: DisplayLead): CompanyIntelligence {
  const { data: persisted } = useOpportunityScore(lead.placeId);

  const intelligence = useMemo(() => {
    const whatsappStatus = lead.whatsapp ? "verified" : "unknown";
    const ctx = {
      hasWebsite: lead.hasWebsite,
      hasValidPhone: !!lead.phone,
      whatsappStatus,
      hasEmail: !!lead.email,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      businessStatus: null,
    } as const;
    const signals = deriveSignals(ctx);
    // Client-side fallback evidence — same pure rule the server persists, so
    // demo mode and legacy rows still render severity/evidence honestly.
    const evidence = buildSignalEvidence(signals, ctx);
    const score = calculateOpportunityScore({
      signals,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      hasWebsite: lead.hasWebsite,
      whatsappStatus,
    });
    const nba = recommendNextBestAction({
      hasWebsite: lead.hasWebsite,
      hasEmail: !!lead.email,
      hasPhone: !!lead.phone,
      whatsappStatus,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      temperature: lead.temperature,
      score: score.total,
    });
    return { evidence, score, nba };
  }, [lead]);

  // Persisted V2 score wins when available; otherwise the client calc (demo
  // fallback). Both come from the same deterministic domain engine.
  const persistedBreakdown = persisted ? asBreakdown(persisted.breakdown) : null;
  const score = persistedBreakdown ?? intelligence.score;
  const temperature = persisted
    ? persisted.temperature
    : opportunityTemperatureFromScore(score.total);

  const scoreState =
    (persistedBreakdown?.scoreState as "ANALISANDO" | "PARCIAL" | "FINALIZADO" | undefined) ??
    deriveOpportunityScoreState({ websiteState: lead.enrichmentState ?? null });

  const evidence = persisted
    ? (asSignalEvidence(persisted.signals) ?? intelligence.evidence)
    : intelligence.evidence;

  return {
    score,
    temperature,
    scoreState,
    evidence,
    nba: intelligence.nba,
    version: persistedBreakdown?.version ?? null,
  };
}
