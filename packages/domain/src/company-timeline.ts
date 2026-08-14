// Company timeline — unified, read-side derived chronology for a COMPANY
// (V3-E). Merges SYSTEM events (jobs, sources, scores — real rows with real
// timestamps) and COMMERCIAL events (lead activities/stage history passed in
// by the caller) into one chronological list. No fabrication: an event only
// exists when its underlying row has a timestamp.

export type CompanyTimelineEventKind = "system" | "commercial";

export interface CompanyTimelineEvent {
  /** Stable id (row-scoped) — used for React keys and dedupe. */
  id: string;
  kind: CompanyTimelineEventKind;
  type: string;
  label: string;
  detail?: string;
  /** ISO timestamp. */
  at: string;
}

export interface TimelineJobRow {
  id: string;
  type: string;
  status: string;
  createdAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
}

export interface TimelineSourceRow {
  id: string;
  provider: string;
  fetchedAt?: string | null;
  error?: string | null;
}

export interface TimelineScoreRow {
  id: string;
  calculatedAt?: string | null;
  score?: number | null;
  temperature?: string | null;
  ruleVersion?: string | null;
}

export interface CompanyTimelineInput {
  jobs: TimelineJobRow[];
  sources: TimelineSourceRow[];
  scores: TimelineScoreRow[];
  /** Commercial events already normalized by the caller (activities, stage
   * history, contacts...). */
  leadEvents?: Array<{
    id: string;
    type: string;
    label: string;
    detail?: string;
    at: string;
  }>;
}

const JOB_TYPE_LABELS: Record<string, string> = {
  COMPANY_DISCOVERY: "Descoberta",
  COMPANY_NORMALIZATION: "Normalização",
  COMPANY_DEDUPLICATION: "Deduplicação",
  BUSINESS_DATA_ENRICHMENT: "Enriquecimento (website)",
  DIGITAL_PRESENCE_ANALYSIS: "Presença digital",
  CONTACT_ENRICHMENT: "Enriquecimento de contato",
  WHATSAPP_VALIDATION: "Validação de WhatsApp",
  REPUTATION_ANALYSIS: "Reputação",
  OPPORTUNITY_SCORING: "Qualificação (score)",
  TERRITORY_ANALYSIS: "Território",
  NEXT_BEST_ACTION: "Próxima melhor ação",
};

const SOURCE_PROVIDER_LABELS: Record<string, string> = {
  google_places: "Dados do Google Places",
  website: "Site da empresa",
  business_registry: "Cadastro público (CNPJ)",
  manual: "Dado manual",
};

export function jobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type;
}

export function sourceProviderLabel(provider: string): string {
  return SOURCE_PROVIDER_LABELS[provider] ?? provider;
}

/**
 * Build the unified company timeline, newest first. Stable ids per row keep
 * React rendering and dedupe deterministic; equal timestamps keep insertion
 * order (stable sort).
 */
export function buildCompanyTimeline(input: CompanyTimelineInput): CompanyTimelineEvent[] {
  const events: CompanyTimelineEvent[] = [];

  for (const j of input.jobs) {
    if (j.createdAt) {
      events.push({
        id: `job:${j.id}:created`,
        kind: "system",
        type: "job_queued",
        label: `${jobTypeLabel(j.type)} na fila`,
        at: j.createdAt,
      });
    }
    if (j.finishedAt && j.status === "completed") {
      events.push({
        id: `job:${j.id}:completed`,
        kind: "system",
        type: "job_completed",
        label: `${jobTypeLabel(j.type)} concluído`,
        at: j.finishedAt,
      });
    }
    if (j.finishedAt && j.status === "failed") {
      events.push({
        id: `job:${j.id}:failed`,
        kind: "system",
        type: "job_failed",
        label: `${jobTypeLabel(j.type)} falhou`,
        detail: j.error ?? undefined,
        at: j.finishedAt,
      });
    }
  }

  for (const s of input.sources) {
    if (!s.fetchedAt) continue;
    const label = sourceProviderLabel(s.provider);
    events.push({
      id: `source:${s.id}`,
      kind: "system",
      type: s.error ? "source_failed" : "source_enriched",
      label: s.error ? `${label} falhou` : `${label} consultado`,
      detail: s.error ?? undefined,
      at: s.fetchedAt,
    });
  }

  for (const sc of input.scores) {
    if (!sc.calculatedAt) continue;
    events.push({
      id: `score:${sc.id}`,
      kind: "system",
      type: "score_changed",
      label: `Score ${sc.score ?? "—"} (${sc.temperature ?? "—"})`,
      detail: sc.ruleVersion ?? undefined,
      at: sc.calculatedAt,
    });
  }

  for (const l of input.leadEvents ?? []) {
    events.push({ ...l, kind: "commercial" });
  }

  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
