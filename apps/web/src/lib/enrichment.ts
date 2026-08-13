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
