import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import {
  calculateOpportunityScore,
  deriveSignals,
  OPPORTUNITY_SCORE_VERSION,
  opportunityTemperatureFromScore,
  recommendNextBestAction,
} from "@leads/domain";
import type { Lead } from "@/types";
import { ScorePill } from "@/components/shared/Badges";

const SIGNAL_LABELS: Record<string, string> = {
  NO_WEBSITE: "Sem site",
  LOW_REVIEW_COUNT: "Poucas avaliações",
  HIGH_RATING: "Bem avaliada",
  WEAK_REPUTATION: "Reputação fraca",
  WHATSAPP_AVAILABLE: "WhatsApp provável",
  WHATSAPP_VALIDATED: "WhatsApp validado",
  INSTAGRAM_WEAK: "Instagram fraco",
  BUSINESS_ACTIVE: "Negócio ativo",
  NEW_BUSINESS: "Negócio novo",
  VALID_PHONE: "Telefone válido",
  HAS_EMAIL: "Tem e-mail",
  HIGH_LOCAL_DENSITY: "Alta densidade local",
  LOW_DIGITAL_COMPETITION: "Baixa concorrência digital",
};

const URGENCY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

/**
 * Company Intelligence Card — the V2 explainable opportunity score (7 weighted
 * components), the named signals behind it, and the next-best-action. Computed
 * client-side from the shared domain, so it is always in sync with the server's
 * scoring (`score-company`).
 */
export function CompanyIntelligenceCard({ lead }: { lead: Lead }) {
  const intelligence = useMemo(() => {
    const whatsappStatus = lead.whatsapp ? "verified" : "unknown";
    const signals = deriveSignals({
      hasWebsite: lead.hasWebsite,
      hasValidPhone: !!lead.phone,
      whatsappStatus,
      hasEmail: !!lead.email,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      businessStatus: null,
    });
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
    return { signals, score, nba };
  }, [lead]);

  const { signals, score, nba } = intelligence;
  const temperature = opportunityTemperatureFromScore(score.total);

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-micro font-semibold uppercase tracking-wide text-primary">
            Inteligência de oportunidade
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{OPPORTUNITY_SCORE_VERSION}</span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ScorePill score={score.total} temperature={temperature} />
        <span className="text-caption text-muted-foreground">
          confiança {Math.round(score.confidence * 100)}%
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {score.components.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span className="w-36 shrink-0 truncate text-muted-foreground" title={c.reason}>
              {c.label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.score}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right font-medium tabular-nums">{c.score}</span>
          </div>
        ))}
      </div>

      {signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {signals.map((s) => (
            <span
              key={s}
              className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {SIGNAL_LABELS[s] ?? s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-primary/15 bg-primary-subtle p-3">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-wide text-primary">
            Próxima melhor ação
          </p>
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            urgência {URGENCY_LABEL[nba.urgency]}
          </span>
        </div>
        <p className="mt-1 text-caption font-medium text-foreground">{nba.recommendation}</p>
        <p className="mt-0.5 text-micro text-muted-foreground">{nba.reason}</p>
      </div>
    </div>
  );
}
