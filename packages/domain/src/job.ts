// Job domain — the vocabulary for the async enrichment pipeline (spec #14, #15,
// #20, #21, #71). Pure types + rules only: no transport, no BullMQ, no storage.
// The concrete queue lives behind the JobQueue interface (job-queue.ts); today
// that is `functions.invoke` + a `jobs` table (ADR-001: no Redis/BullMQ yet).

export const JOB_TYPES = [
  "COMPANY_DISCOVERY",
  "COMPANY_NORMALIZATION",
  "COMPANY_DEDUPLICATION",
  "BUSINESS_DATA_ENRICHMENT",
  "DIGITAL_PRESENCE_ANALYSIS",
  "CONTACT_ENRICHMENT",
  "WHATSAPP_VALIDATION",
  "REPUTATION_ANALYSIS",
  "OPPORTUNITY_SCORING",
  "TERRITORY_ANALYSIS",
  "NEXT_BEST_ACTION",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "partially_completed",
  "failed",
  "retrying",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["processing", "cancelled"],
  processing: ["completed", "partially_completed", "failed", "retrying", "cancelled"],
  retrying: ["queued", "processing", "failed", "cancelled"],
  completed: [],
  partially_completed: [],
  // `failed` may be manually requeued (admin) — that is a new transition, not a
  // silent auto-retry.
  failed: ["queued"],
  cancelled: [],
};

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
];

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export interface Job {
  id: string;
  type: JobType;
  organizationId: string;
  searchId?: string | null;
  companyId?: string | null;
  status: JobStatus;
  /** Times this job has been executed (0 = never ran). */
  attempt: number;
  priority: number;
  payload: unknown;
  result?: unknown;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

// ── Retry policy ────────────────────────────────────────────────────────────

export const DEFAULT_MAX_ATTEMPTS = 3;

export type RetryErrorClass =
  | "retryable"
  | "non_retryable"
  | "rate_limited"
  | "provider_unavailable"
  | "invalid_data";

/**
 * Classify a failure so the queue knows whether (and how) to retry. Permanent
 * errors (invalid data, authz) must NOT loop forever (spec #20).
 */
export function classifyRetryableError(err: {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}): RetryErrorClass {
  const status = err.status;
  if (status === 429) return "rate_limited";
  if (status != null && status >= 500) return "provider_unavailable";
  if (status != null && status >= 400) {
    return status === 400 || status === 422 ? "invalid_data" : "non_retryable";
  }
  const msg = `${err.message ?? ""} ${err.code ?? ""} ${err.name ?? ""}`.toLowerCase();
  if (/timeout|timed ?out|etimedout|abort/i.test(msg)) return "retryable";
  if (/invalid|malformed|schema|validation|parse/i.test(msg)) return "invalid_data";
  if (/unavailable|econnrefused|econnreset|enetunreach|503|502/i.test(msg))
    return "provider_unavailable";
  return "retryable"; // unknown/transient → retry (bounded by max attempts)
}

export function isRetryableError(err: {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}): boolean {
  const cls = classifyRetryableError(err);
  return cls === "retryable" || cls === "rate_limited" || cls === "provider_unavailable";
}

/**
 * Exponential backoff with a cap, plus EQUITABLE JITTER (50–100% of the capped
 * deterministic delay) so jobs that fail together don't retry together
 * (thundering herd). The randomness source is INJECTABLE — the function stays
 * pure and deterministic in tests; production call sites use the default
 * Math.random. Injecting `() => 1` reproduces the exact pre-jitter values, so
 * the cap (maxMs) and the growth contract are preserved. `attempt` is 1-based
 * (first retry → base delay).
 */
export function backoffDelayMs(
  attempt: number,
  baseMs = 2000,
  maxMs = 60_000,
  random: () => number = Math.random,
): number {
  const exp = baseMs * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(exp, maxMs);
  // Equitable jitter: the delay is uniform in [50%, 100%] of the capped value.
  // Upper bound stays at the cap (never exceeds maxMs); lower bound halves.
  return Math.round(capped * (0.5 + 0.5 * random()));
}

/** A failed job that exhausted its attempts is the dead-letter-equivalent state. */
export function isDeadLetter(job: Pick<Job, "status" | "attempt">): boolean {
  return job.status === "failed" && job.attempt >= DEFAULT_MAX_ATTEMPTS;
}

// ── Idempotency ─────────────────────────────────────────────────────────────

/** Per-company processing key — retries never re-consume credits or re-run side effects. */
export function companyProcessingKey(
  organizationId: string,
  searchId: string,
  companyId: string,
): string {
  return `company-processing:${organizationId}:${searchId}:${companyId}`;
}
