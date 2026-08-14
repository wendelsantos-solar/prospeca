// Enrichment state machine for a discovered business (place).
//
// The critical distinction the UI must preserve: "not found" (we checked and the
// business genuinely lacks the signal) is NOT the same as "pending" (we have not
// verified yet). A freshly-discovered place starts `pending`; enrichment fills
// per-field status; the overall state is DERIVED from the field states — never
// stored by hand — so the scalar and the field map can't drift.

export const ENRICHMENT_FIELDS = ["email", "instagram", "whatsapp"] as const;
export type EnrichmentFieldName = (typeof ENRICHMENT_FIELDS)[number];

/** Per-field lifecycle. `complete` = checked (has true/false). `failed` = the
 * provider errored on this field. Absent from the map = `pending` (unchecked). */
export type FieldState = "complete" | "failed";

export interface EnrichmentFieldStatus {
  status: FieldState;
  /** Whether the field actually holds a value (only meaningful when complete). */
  has: boolean;
}

/** Partial by key — a missing key means the field is still `pending`. */
export type EnrichmentFieldMap = Partial<Record<EnrichmentFieldName, EnrichmentFieldStatus>>;

export const ENRICHMENT_STATES = [
  "pending",
  "processing",
  "enriched",
  "partial",
  "failed",
] as const;
export type EnrichmentState = (typeof ENRICHMENT_STATES)[number];

export function isTerminalEnrichment(state: EnrichmentState): boolean {
  return state === "enriched" || state === "partial" || state === "failed";
}

/**
 * Derive the overall enrichment state from the per-field map:
 *   - no fields at all            → pending (nothing checked yet)
 *   - any field still in-flight   → processing
 *   - some complete, some failed  → partial
 *   - all complete (≥1)           → enriched
 *   - all failed                  → failed
 *
 * Note: with the single website-scraper source today, per-field failure is
 * all-or-nothing, so `partial` is future-proofing for multi-source enrichment
 * (e.g. website ok + social timeout → PARTIAL, matching the brief).
 */
export function deriveEnrichmentState(fields: EnrichmentFieldMap): EnrichmentState {
  const statuses = Object.values(fields).map((f) => f.status);
  if (statuses.length === 0) return "pending";
  const anyComplete = statuses.includes("complete");
  const anyFailed = statuses.includes("failed");
  if (anyComplete && anyFailed) return "partial";
  if (anyComplete) return "enriched";
  return "failed";
}

/**
 * Build the per-field map from the outcome of one enrichment pass. `complete`
 * fields were checked (has = found). `failed` fields errored. Fields not listed
 * in either array stay absent (→ pending).
 */
export function buildFieldMap(
  complete: Array<{ field: EnrichmentFieldName; has: boolean }>,
  failed: EnrichmentFieldName[],
): EnrichmentFieldMap {
  const map: EnrichmentFieldMap = {};
  for (const { field, has } of complete) map[field] = { status: "complete", has };
  for (const field of failed) if (!map[field]) map[field] = { status: "failed", has: false };
  return map;
}

// ── Multi-source state (Fase 5) ─────────────────────────────────────────────
//
// Per-source lifecycle ON TOP of the field-level map above. The global
// `enrichment_state`/`enrichment_fields` stay derived exactly as before
// (retrocompat: the old UI keeps working); `enrichment_sources` adds a
// per-source status + TTL so each source revalidates on its own horizon.
//
// Persisted shape on places.enrichment_sources:
//   { website: {status, fetchedAt, expiresAt}, business_registry: {...} }

export const ENRICHMENT_SOURCES = ["website", "business_registry"] as const;
export type EnrichmentSourceKey = (typeof ENRICHMENT_SOURCES)[number];

/** TTL per source in days — website re-checked monthly, registry quarterly. */
export const ENRICHMENT_SOURCE_TTL_DAYS: Record<EnrichmentSourceKey, number> = {
  website: 30,
  business_registry: 90,
};

export interface EnrichmentSourceState {
  status: EnrichmentState;
  fetchedAt?: string | null;
  expiresAt?: string | null;
}

export type EnrichmentSourceMap = Partial<Record<EnrichmentSourceKey, EnrichmentSourceState>>;

/** Build a per-source state entry from one pass's outcome. */
export function buildSourceState(
  status: EnrichmentState,
  fetchedAt: Date,
  ttlDays: number,
): EnrichmentSourceState {
  return {
    status,
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: new Date(fetchedAt.getTime() + ttlDays * 86400000).toISOString(),
  };
}

/** The state of one source — `pending` when it has never been checked. */
export function deriveSourceState(
  sources: EnrichmentSourceMap | null | undefined,
  sourceKey: EnrichmentSourceKey,
): EnrichmentState {
  return sources?.[sourceKey]?.status ?? "pending";
}

/**
 * Should this source be re-consulted? True when: never checked (absent),
 * failed (always re-checkable), past its TTL, or missing an expiry.
 * A fresh, successful source is NOT stale.
 */
export function isEnrichmentSourceStale(
  sources: EnrichmentSourceMap | null | undefined,
  sourceKey: EnrichmentSourceKey,
  now: Date = new Date(),
): boolean {
  const s = sources?.[sourceKey];
  if (!s) return true;
  if (s.status === "failed") return true;
  if (!s.expiresAt) return true;
  return new Date(s.expiresAt).getTime() <= now.getTime();
}

// ── UI-facing interpretation ──────────────────────────────────────────

export type FieldDisplay = "value" | "not_found" | "checking" | "pending" | "error";

/**
 * How a field should be rendered in the UI. `hasValue` (the actual data) wins;
 * then the per-field status; then the overall state for the in-flight case.
 */
export function fieldDisplay(
  fieldStatus: FieldState | undefined,
  hasValue: boolean,
  overall: EnrichmentState,
): FieldDisplay {
  if (hasValue) return "value";
  if (fieldStatus === "complete") return "not_found";
  if (fieldStatus === "failed") return "error";
  if (overall === "processing") return "checking";
  return "pending";
}
