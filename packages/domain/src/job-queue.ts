// JobQueue — the transport abstraction (spec #13).
//
// The domain depends on THIS interface, never on BullMQ or functions.invoke
// directly. Today the implementation is `functions.invoke` chaining + a `jobs`
// table (ADR-001); BullMQ (Redis) is a future implementation behind this same
// interface, adopted only if edge-function timeouts force it.
//
// All methods are async and tenant-scoped: the caller supplies organization_id
// explicitly; the worker must validate tenant context (spec #92, #93).

import type { Job, JobStatus, JobType } from "./job.ts";

export interface EnqueueJob {
  type: JobType;
  organizationId: string;
  searchId?: string | null;
  companyId?: string | null;
  priority?: number;
  payload?: unknown;
  /** When set, duplicate enqueues with the same key are a no-op. */
  idempotencyKey?: string;
}

export interface JobQueue {
  enqueue(input: EnqueueJob): Promise<{ jobId: string }>;
  /** Claim the next queued/retrying job of the given types for a worker. */
  claim(types: JobType[], workerId: string): Promise<Job | null>;
  complete(jobId: string, result?: unknown): Promise<void>;
  /** Mark failed; the implementation decides whether to retry (via classifyRetryableError). */
  fail(jobId: string, error: unknown): Promise<void>;
  /** Requeue with a delay (backoffDelayMs), respecting max attempts. */
  retry(jobId: string, delayMs?: number): Promise<void>;
  cancel(jobId: string): Promise<void>;
  /** Inspect without claiming (admin/debug). */
  get(jobId: string): Promise<Job | null>;
  /** Progress counters for a search (for the visible queue, spec #17). */
  countsByStatus(searchId: string): Promise<Record<JobStatus, number>>;
}
