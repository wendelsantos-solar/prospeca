import { Sparkles } from "lucide-react";
import { OPPORTUNITY_SCORE_VERSION } from "@leads/domain";
import type { Lead } from "@/types";
import { useCompanyIntelligence, type CompanyIntelligence } from "@/hooks/useCompanyIntelligence";
import { ScorePill } from "@/components/shared/Badges";
import { cn } from "@/lib/utils";
import type { SignalSeverity } from "@leads/domain";

export const SIGNAL_LABELS: Record<string, string> = {
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
  ESTABLISHED_COMPANY: "Empresa consolidada",
  WEAK_WEBSITE: "Site fraco",
  NO_SOCIAL_PRESENCE: "Sem presença social",
  HIGH_LOCAL_DEMAND: "Alta demanda local",
  DECISION_MAKER_IDENTIFIED: "Decisor identificado",
  DECISION_MAKER_HIGH: "Decisor de alta influência",
};

const URGENCY_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const SEVERITY_STYLES: Record<SignalSeverity, string> = {
  high: "bg-hot-soft text-hot",
  medium: "bg-warning-soft text-warning-foreground",
  low: "bg-muted text-muted-foreground",
};

export { SEVERITY_STYLES };

/** Evidence chips com severidade/confiança/fonte — compartilhado com o card
 * Reputação (Visão geral) para nunca duplicar a formatação honesta. */
export function SignalEvidenceChips({
  evidence,
  filter,
}: {
  evidence: CompanyIntelligence["evidence"];
  /** Restringe a um subconjunto de sinais (ex: só reputação). */
  filter?: (signal: string) => boolean;
}) {
  const items = filter ? evidence.filter((e) => filter(e.signal)) : evidence;
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((e) => (
        <span
          key={e.signal}
          className={cn(
            "cursor-default rounded-full px-2 py-0.5 text-[10px] font-medium",
            SEVERITY_STYLES[e.severity],
          )}
          title={`${e.evidence} · confiança ${Math.round(e.confidence * 100)}% · ${e.source}`}
        >
          {SIGNAL_LABELS[e.signal] ?? e.signal}
        </span>
      ))}
    </div>
  );
}

/** O estado do score em texto + chip (analisando/parcial/finalizado) — único
 * lugar que traduz o scoreState para UI. */
export function ScoreStateChip({ scoreState }: { scoreState: CompanyIntelligence["scoreState"] }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        scoreState === "FINALIZADO"
          ? "border-primary/30 bg-primary-soft text-primary"
          : scoreState === "PARCIAL"
            ? "border-warning/40 bg-warning-soft text-warning-foreground"
            : "border-dashed border-border text-muted-foreground",
      )}
      title={
        scoreState === "FINALIZADO"
          ? "Fontes automáticas concluídas"
          : scoreState === "PARCIAL"
            ? "Uma fonte consultada falhou — score parcial"
            : "Análise em andamento — o score pode mudar"
      }
    >
      {scoreState === "FINALIZADO"
        ? "finalizado"
        : scoreState === "PARCIAL"
          ? "parcial"
          : "analisando"}
    </span>
  );
}

/**
 * Company Intelligence Card — the V2 explainable opportunity score (7 weighted
 * components), the named signals behind it, and (opcional) the next-best-action.
 * Responde "POR QUE 84": cada componente tem barra, pontos e razão.
 */
export function CompanyIntelligenceCard({
  lead,
  showNba = true,
}: {
  lead: Lead;
  showNba?: boolean;
}) {
  const { score, temperature, scoreState, evidence, nba, version } = useCompanyIntelligence(lead);

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-micro font-semibold uppercase tracking-wide text-primary">
            Inteligência de oportunidade
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {version ?? OPPORTUNITY_SCORE_VERSION}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ScorePill score={score.total} temperature={temperature} />
        <span className="text-caption text-muted-foreground">
          confiança {Math.round(score.confidence * 100)}%
        </span>
        <ScoreStateChip scoreState={scoreState} />
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

      <div className="mt-3">
        <SignalEvidenceChips evidence={evidence} />
      </div>

      {showNba && (
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
      )}
    </div>
  );
}
