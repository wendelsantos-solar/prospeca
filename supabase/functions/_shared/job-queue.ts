// Concrete JobQueue over the `jobs` table (ADR-001: no Redis/BullMQ).
//
// Implements the domain interface (packages/domain/src/job-queue.ts) with
// Postgres as the shared store and functions.invoke as the wake transport.
// All access uses the SERVICE ROLE client — callers (edge functions) already
// prove tenant context before enqueueing; rows are tenant-scoped by
// organization_id and the worker validates org context per handler.
//
// Concurrency: claim is an atomic conditional UPDATE guarded by
// `status = 'queued'` — only one worker wins the flip to 'processing' (same
// guarantee as FOR UPDATE SKIP LOCKED for this update; losers get no row and
// move to the next candidate).
//
// Retry: fail() classifies the error with the pure domain rule
// (classifyRetryableError) and either parks the job in `retrying` with a
// `not_before = now + backoffDelayMs(attempt)` or fails it permanently.
// Exhausted attempts (attempt >= DEFAULT_MAX_ATTEMPTS) → `failed` (dead-letter).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  backoffDelayMs,
  classifyRetryableError,
  DEFAULT_MAX_ATTEMPTS,
  isRetryableError,
  type Job,
  type JobStatus,
  type JobType,
} from "@leads/domain/job";
import type { EnqueueJob, JobQueue } from "@leads/domain/job-queue";

const JOB_COLUMNS =
  "id, type, organization_id, search_id, place_id, status, attempt, priority, payload, result, error, started_at, finished_at, created_at";

type JobRow = {
  id: string;
  type: JobType;
  organization_id: string;
  search_id: string | null;
  place_id: string | null;
  status: JobStatus;
  attempt: number;
  priority: number;
  payload: unknown;
  result: unknown;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    organizationId: row.organization_id,
    searchId: row.search_id,
    companyId: row.place_id,
    status: row.status,
    attempt: row.attempt,
    priority: row.priority,
    payload: row.payload,
    result: row.result,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function errorShape(error: unknown): {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
} {
  if (error instanceof Error) return { message: error.message, name: error.name };
  if (typeof error === "string") return { message: error };
  if (error && typeof error === "object") return error as { message?: string; status?: number };
  return {};
}

export function createSupabaseJobQueue(admin: SupabaseClient): JobQueue {
  return {
    async enqueue(input: EnqueueJob): Promise<{ jobId: string }> {
      const row = {
        organization_id: input.organizationId,
        type: input.type,
        search_id: input.searchId ?? null,
        place_id: input.companyId ?? null,
        priority: input.priority ?? 0,
        payload: input.payload ?? null,
        idempotency_key: input.idempotencyKey ?? null,
      };

      if (input.idempotencyKey) {
        // Dedupe real: the unique partial index makes the conflicting upsert a
        // no-op (ignoreDuplicates); we then return the existing row's id.
        const { data: inserted } = await admin
          .from("jobs")
          .upsert(row, {
            onConflict: "organization_id,idempotency_key",
            ignoreDuplicates: true,
          })
          .select("id")
          .maybeSingle();
        if (inserted) return { jobId: inserted.id as string };
        const { data: existing } = await admin
          .from("jobs")
          .select("id")
          .eq("organization_id", input.organizationId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
        if (existing) return { jobId: existing.id as string };
        throw new Error("job enqueue: unique idempotency_key sem linha correspondente");
      }

      const { data: inserted, error } = await admin
        .from("jobs")
        .insert(row)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`job enqueue: ${error.message}`);
      return { jobId: (inserted?.id as string) ?? crypto.randomUUID() };
    },

    async claim(types: JobType[], workerId: string): Promise<Job | null> {
      const now = new Date().toISOString();
      const { data: candidates, error } = await admin
        .from("jobs")
        .select("id, attempt")
        .in("type", types)
        .eq("status", "queued")
        .or(`not_before.is.null,not_before.lte.${now}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) throw new Error(`job claim scan: ${error.message}`);

      for (const candidate of (candidates ?? []) as Array<{ id: string; attempt: number | null }>) {
        // Atomic flip: the status guard means only ONE worker gets the row.
        const { data: claimed, error: claimError } = await admin
          .from("jobs")
          .update({
            status: "processing",
            worker_id: workerId,
            attempt: (candidate.attempt ?? 0) + 1,
            started_at: new Date().toISOString(),
          })
          .eq("id", candidate.id)
          .eq("status", "queued")
          .select(JOB_COLUMNS)
          .maybeSingle();
        if (claimError) throw new Error(`job claim: ${claimError.message}`);
        if (claimed) return mapJob(claimed as unknown as JobRow);
        // Another worker won this row — try the next candidate.
      }
      return null;
    },

    async complete(jobId: string, result?: unknown): Promise<void> {
      const { error } = await admin
        .from("jobs")
        .update({
          status: "completed",
          result: result ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (error) throw new Error(`job complete: ${error.message}`);
    },

    async fail(jobId: string, error: unknown): Promise<void> {
      const { data: job } = await admin
        .from("jobs")
        .select("attempt, status")
        .eq("id", jobId)
        .maybeSingle();
      const attempt = (job?.attempt ?? 0) as number;

      if (
        isRetryableError(errorShape(error)) &&
        attempt < DEFAULT_MAX_ATTEMPTS
      ) {
        // Parked retry: sweeper flips retrying→queued when not_before passes.
        const { error: upErr } = await admin
          .from("jobs")
          .update({
            status: "retrying",
            not_before: new Date(Date.now() + backoffDelayMs(attempt)).toISOString(),
            error: errorShape(error).message ?? "unknown error",
            result: null,
          })
          .eq("id", jobId);
        if (upErr) throw new Error(`job fail(retry): ${upErr.message}`);
        return;
      }

      // Permanent: invalid data, non-retryable, or attempts exhausted → DLQ.
      const { error: upErr } = await admin
        .from("jobs")
        .update({
          status: "failed",
          error: errorShape(error).message ?? "unknown error",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (upErr) throw new Error(`job fail(terminal): ${upErr.message}`);
    },

    async retry(jobId: string, delayMs?: number): Promise<void> {
      const delay = delayMs ?? backoffDelayMs(1);
      const { error } = await admin
        .from("jobs")
        .update({
          status: "retrying",
          not_before: new Date(Date.now() + delay).toISOString(),
          error: null,
        })
        .eq("id", jobId);
      if (error) throw new Error(`job retry: ${error.message}`);
    },

    async cancel(jobId: string): Promise<void> {
      const { error } = await admin
        .from("jobs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("id", jobId)
        .in("status", ["queued", "processing", "retrying"]);
      if (error) throw new Error(`job cancel: ${error.message}`);
    },

    async get(jobId: string): Promise<Job | null> {
      const { data } = await admin
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("id", jobId)
        .maybeSingle();
      return data ? mapJob(data as unknown as JobRow) : null;
    },

    async countsByStatus(searchId: string): Promise<Record<JobStatus, number>> {
      const { data } = await admin
        .from("jobs")
        .select("status")
        .eq("search_id", searchId);
      const counts: Record<JobStatus, number> = {
        queued: 0,
        processing: 0,
        completed: 0,
        partially_completed: 0,
        failed: 0,
        retrying: 0,
        cancelled: 0,
      };
      for (const row of (data ?? []) as Array<{ status: JobStatus }>) {
        if (row.status in counts) counts[row.status] += 1;
      }
      return counts;
    },
  };
}

// Re-exported so handlers share the same retry classification vocabulary.
export { classifyRetryableError, isRetryableError };

/**
 * Stamp duration + estimated cost on a job before the handler closes it
 * (Fase 7 observability). Reads the claim's started_at and writes
 * duration_ms/estimated_cost. Handlers call this right before complete/fail.
 */
export interface JobCostInput {
  /** Custo REAL (provider reportou) — null = não reportado. */
  realCostUsd: number | null;
  /** Custo ESTIMADO pela tabela do domínio — null = desconhecido. */
  estimatedCostUsd: number | null;
  /** 'measured' | 'estimated' | null (null = custo desconhecido). */
  costSource?: "measured" | "estimated" | null;
}

/**
 * Stamp duration + cost on a job before the handler closes it
 * (Fase 7 observability). Reads the claim's started_at and writes
 * duration_ms/estimated_cost/real_cost_usd/cost_source.
 * REGRA DURA: custo desconhecido é NULL, nunca 0.
 */
export async function stampJobMetrics(
  admin: SupabaseClient,
  jobId: string,
  cost?: JobCostInput | null,
): Promise<void> {
  const { data: job } = await admin
    .from("jobs")
    .select("started_at")
    .eq("id", jobId)
    .maybeSingle();
  const startedAt = (job?.started_at as string | null) ?? null;
  const durationMs = startedAt
    ? Math.max(0, Date.now() - new Date(startedAt).getTime())
    : null;
  const { error } = await admin
    .from("jobs")
    .update({
      duration_ms: durationMs,
      estimated_cost: cost?.estimatedCostUsd ?? null,
      real_cost_usd: cost?.realCostUsd ?? null,
      cost_source: cost?.costSource ?? null,
    })
    .eq("id", jobId);
  if (error) throw new Error(`job metrics: ${error.message}`);
}
