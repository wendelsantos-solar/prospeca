import { fieldDisplay } from "@leads/domain";
import type { DiscoveryResult } from "@leads/contracts";

export type EnrichmentFieldKey = "email" | "instagram" | "whatsapp";

export type EnrichmentDisplayKind = "value" | "not_found" | "checking" | "pending" | "error";

export interface EnrichmentDisplay {
  kind: EnrichmentDisplayKind;
  /** Empty string when kind === "value" (the caller renders the value itself). */
  label: string;
  tone: "muted" | "info" | "error";
}

const LABELS: Record<
  Exclude<EnrichmentDisplayKind, "value">,
  { label: string; tone: "muted" | "info" | "error" }
> = {
  not_found: { label: "Não encontrado", tone: "muted" },
  checking: { label: "Verificando…", tone: "info" },
  pending: { label: "Ainda não verificado", tone: "info" },
  error: { label: "Erro na consulta", tone: "error" },
};

/**
 * Resolve how a contact field should be rendered, preserving the critical
 * distinction between "não possui/não encontrado" (checked, genuinely absent)
 * and "ainda não verificado" (never checked) — a temporary data gap, not a fact.
 */
export function enrichmentDisplayFor(
  field: EnrichmentFieldKey,
  hasValue: boolean,
  state: DiscoveryResult["enrichmentState"] | undefined,
  fields: DiscoveryResult["enrichmentFields"] | null | undefined,
): EnrichmentDisplay {
  const fieldStatus = fields?.[field]?.status as "complete" | "failed" | undefined;
  const kind = fieldDisplay(fieldStatus, hasValue, state ?? "pending");
  if (kind === "value") return { kind, label: "", tone: "muted" };
  const meta = LABELS[kind];
  return { kind, label: meta.label, tone: meta.tone };
}

/** True when enrichment is still in flight or never started — the score is a
 * preliminary estimate that will move as data arrives. */
export function isProvisionalScore(state: DiscoveryResult["enrichmentState"] | undefined): boolean {
  return state == null || state === "pending" || state === "processing";
}

// ── Async-status badge (DiscoveryCard) ────────────────────────────────

/** The single async-status badge a DiscoveryCard may show. */
export type EnrichmentStatusState = "queued" | "enriching" | "retrying" | "failed" | "provisional";

export interface EnrichmentStatusMeta {
  label: string;
  ariaLabel: string;
  title: string;
  spinner: boolean;
  dashed: boolean;
  tone: "primary" | "warning" | "muted";
}

export const ENRICHMENT_STATUS_META: Record<EnrichmentStatusState, EnrichmentStatusMeta> = {
  queued: {
    label: "na fila",
    ariaLabel: "Empresa na fila para o enriquecimento dos dados",
    title: "O enriquecimento dos dados desta empresa ainda não começou.",
    spinner: true,
    dashed: true,
    tone: "muted",
  },
  enriching: {
    label: "enriquecendo",
    ariaLabel: "Enriquecendo os dados desta empresa",
    title: "Estamos buscando os dados de contato desta empresa agora.",
    spinner: true,
    dashed: false,
    tone: "primary",
  },
  retrying: {
    label: "reprocessando",
    ariaLabel: "Reprocessando o enriquecimento dos dados desta empresa",
    title: "A tentativa anterior falhou; estamos tentando enriquecer novamente.",
    spinner: true,
    dashed: false,
    tone: "warning",
  },
  failed: {
    label: "score parcial",
    ariaLabel: "Enriquecimento falhou; o score desta empresa está parcial",
    title: "Não conseguimos enriquecer esta empresa; o score usa apenas os dados disponíveis.",
    spinner: false,
    dashed: false,
    tone: "warning",
  },
  provisional: {
    label: "provisório",
    ariaLabel: "Score provisório para esta empresa",
    title: "Este score é uma estimativa preliminar e pode mudar após o enriquecimento.",
    spinner: false,
    dashed: true,
    tone: "muted",
  },
};

/** Single source of truth for which async-status badge a DiscoveryCard shows.
 * Precedence: retrying > enriching > queued > failed > provisional.
 * Any in-flight pipeline state suppresses the provisional badge. */
export function resolveEnrichmentStatus(
  pipelineState: DiscoveryResult["pipelineState"],
  enrichmentState: DiscoveryResult["enrichmentState"] | undefined,
): EnrichmentStatusState | null {
  if (pipelineState === "retrying") return "retrying";
  if (pipelineState === "enriching") return "enriching";
  if (pipelineState === "queued") return "queued";
  if (pipelineState == null && enrichmentState === "failed") return "failed";
  if (isProvisionalScore(enrichmentState)) return "provisional";
  return null;
}
