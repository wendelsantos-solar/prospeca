// Mission pipeline — derives the visual processing stages of a mission from
// REAL data only (search status, job counts, per-source enrichment states).
// Never fabricates progress: stages without data stay "waiting" (○), a stage
// only shows ✓/⟳/✗ when the underlying rows prove it.

export type PipelineStepKey = "discovery" | "enrichment" | "validation" | "qualification";

export type PipelineStepState = "done" | "running" | "waiting" | "failed";

export interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  state: PipelineStepState;
  /** Honest human-readable detail derived from the counts (e.g. "16/16"). */
  detail: string;
}

export interface MissionPipelineInput {
  /** searches.status. */
  searchStatus: string | null;
  /** searches.found_count. */
  foundCount: number;
  /** Number of search_results rows (places in this mission). */
  totalPlaces: number;
  /** jobs counts: type → status → count (real rows only). */
  jobCounts: Record<string, Record<string, number>>;
  /** Per-source enrichment states across the mission's places. */
  sourceCounts: {
    website: { done: number; running: number; failed: number };
    registry: { done: number; running: number; failed: number };
  };
}

export const PIPELINE_ICON: Record<PipelineStepState, string> = {
  done: "✓",
  running: "⟳",
  waiting: "○",
  failed: "✗",
};

function discoveryStep(input: MissionPipelineInput): PipelineStep {
  const s = input.searchStatus;
  if (s === "completed" || s === "partial") {
    return {
      key: "discovery",
      label: "Descobrir",
      state: "done",
      detail: `${input.foundCount} empresa${input.foundCount === 1 ? "" : "s"}${s === "partial" ? " (parcial)" : ""}`,
    };
  }
  if (s === "failed" || s === "cancelled") {
    return { key: "discovery", label: "Descobrir", state: "failed", detail: s };
  }
  if (s === "queued" || s === "searching" || s === "importing" || s === "enriching") {
    return { key: "discovery", label: "Descobrir", state: "running", detail: s };
  }
  return { key: "discovery", label: "Descobrir", state: "waiting", detail: "aguardando" };
}

function enrichmentStep(input: MissionPipelineInput): PipelineStep {
  const w = input.sourceCounts.website;
  const jobs =
    input.jobCounts["BUSINESS_DATA_ENRICHMENT"] ??
    input.jobCounts["business_data_enrichment"] ??
    {};
  const running = w.running > 0 || (jobs["processing"] ?? 0) > 0 || (jobs["retrying"] ?? 0) > 0;
  const done = w.done;
  const failed = w.failed + (jobs["failed"] ?? 0);
  const detail = [
    `✓${done}`,
    failed > 0 ? `✗${failed}` : null,
    running ? `⟳${w.running + (jobs["processing"] ?? 0) + (jobs["retrying"] ?? 0)}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (running) return { key: "enrichment", label: "Enriquecer", state: "running", detail };
  if (done > 0 && failed > 0) {
    return { key: "enrichment", label: "Enriquecer", state: "done", detail };
  }
  if (done > 0) return { key: "enrichment", label: "Enriquecer", state: "done", detail };
  if (failed > 0 && done === 0) {
    return { key: "enrichment", label: "Enriquecer", state: "failed", detail };
  }
  return { key: "enrichment", label: "Enriquecer", state: "waiting", detail: "aguardando" };
}

function validationStep(input: MissionPipelineInput): PipelineStep {
  // CNPJ validation is ON-DEMAND (drawer lookup) — a mission with zero
  // consultations honestly shows "sob consulta", never a fake percentage.
  const r = input.sourceCounts.registry;
  const detail = [
    `✓${r.done}`,
    r.failed > 0 ? `✗${r.failed}` : null,
    r.running > 0 ? `⟳${r.running}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  if (r.running > 0) return { key: "validation", label: "Validar", state: "running", detail };
  if (r.done > 0) {
    return { key: "validation", label: "Validar", state: "done", detail };
  }
  if (r.failed > 0) return { key: "validation", label: "Validar", state: "failed", detail };
  return { key: "validation", label: "Validar", state: "waiting", detail: "sob consulta" };
}

function qualificationStep(input: MissionPipelineInput): PipelineStep {
  const jobs =
    input.jobCounts["OPPORTUNITY_SCORING"] ?? input.jobCounts["opportunity_scoring"] ?? {};
  const completed = jobs["completed"] ?? 0;
  const failed = jobs["failed"] ?? 0;
  const inFlight = (jobs["processing"] ?? 0) + (jobs["retrying"] ?? 0) + (jobs["queued"] ?? 0);

  if (inFlight > 0) {
    return {
      key: "qualification",
      label: "Qualificar",
      state: "running",
      detail: `${completed}/${input.totalPlaces}`,
    };
  }
  if (completed >= input.totalPlaces && input.totalPlaces > 0) {
    return {
      key: "qualification",
      label: "Qualificar",
      state: "done",
      detail: `${completed}/${input.totalPlaces}`,
    };
  }
  if (completed > 0) {
    return {
      key: "qualification",
      label: "Qualificar",
      state: "running",
      detail: `${completed}/${input.totalPlaces}`,
    };
  }
  if (failed > 0 && completed === 0) {
    return { key: "qualification", label: "Qualificar", state: "failed", detail: `✗${failed}` };
  }
  return { key: "qualification", label: "Qualificar", state: "waiting", detail: "aguardando" };
}

export function derivePipeline(input: MissionPipelineInput): PipelineStep[] {
  return [
    discoveryStep(input),
    enrichmentStep(input),
    validationStep(input),
    qualificationStep(input),
  ];
}
