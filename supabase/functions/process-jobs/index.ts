// process-jobs: the generic queue worker (spec #13–15, #17). Service-role
// internal-only, like execute-search. Woken by enqueue sites (fire-and-forget);
// drains the `jobs` table via the concrete JobQueue (atomic claim) until the
// queue is empty or the time budget ends, dispatching each claimed job to its
// idempotent handler:
//
//   OPPORTUNITY_SCORING      → score-company     (internal mode; closes the job)
//   BUSINESS_DATA_ENRICHMENT → enrich-discovery  (internal mode; closes the job)
//   any other type           → fail(job, "handler not implemented") — honest,
//                              permanent, visible in the admin DLQ panel.
//
// The worker NEVER self-invokes: liveness comes from enqueue sites waking it
// and from the job sweeper (pg_cron) unblocking stuck/backoff jobs. Handlers
// own their job's completion/failure via the same queue (idempotent).
import { AppError, handleOptions, json, logEvent, newRequestId } from "../_shared/http.ts";
import { adminClient } from "../_shared/auth.ts";
import { isInternalCall } from "../_shared/internal-auth.ts";
import { fireAndForget } from "../_shared/dispatch.ts";
import { createSupabaseJobQueue, stampJobMetrics } from "../_shared/job-queue.ts";
import { JOB_TYPES, type Job } from "@leads/domain/job";

/** Time budget per invocation — below the edge-function timeout with margin. */
const BUDGET_MS = 45_000;
/** Max jobs claimed per inner batch (dispatch is non-blocking, loop repeats). */
const CLAIM_BATCH = 5;

interface HandlerDispatch {
  fn: string;
  body: (job: Job) => Record<string, unknown>;
}

const HANDLERS: Record<string, HandlerDispatch> = {
  OPPORTUNITY_SCORING: {
    fn: "score-company",
    body: (job) => {
      const payload = (job.payload ?? {}) as { searchId?: string; placeId?: string; placeIds?: string[] };
      const placeIds = payload.placeIds ?? (payload.placeId ? [payload.placeId] : undefined);
      return {
        searchId: job.searchId ?? payload.searchId,
        ...(placeIds ? { placeIds } : {}),
        organizationId: job.organizationId,
        jobId: job.id,
      };
    },
  },
  BUSINESS_DATA_ENRICHMENT: {
    fn: "enrich-discovery",
    body: (job) => {
      const payload = (job.payload ?? {}) as { searchId?: string; placeId?: string };
      return {
        searchId: job.searchId ?? payload.searchId,
        placeId: job.companyId ?? payload.placeId,
        organizationId: job.organizationId,
        jobId: job.id,
      };
    },
  },
  TERRITORY_ANALYSIS: {
    fn: "territory-analysis",
    body: (job) => {
      const payload = (job.payload ?? {}) as { searchId?: string };
      return {
        searchId: job.searchId ?? payload.searchId,
        organizationId: job.organizationId,
        jobId: job.id,
      };
    },
  },
};

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;
  const requestId = newRequestId();
  const startedAt = Date.now();

  if (!(await isInternalCall(req))) {
    return new AppError("FORBIDDEN", "Função interna.").toResponse(requestId, req);
  }

  const admin = adminClient();
  const queue = createSupabaseJobQueue(admin);
  const workerId = `process-jobs-${crypto.randomUUID()}`;

  let processed = 0;
  let dispatched = 0;
  let failedNoHandler = 0;

  try {
    while (Date.now() - startedAt < BUDGET_MS) {
      let claimedInBatch = 0;
      for (let i = 0; i < CLAIM_BATCH; i++) {
        if (Date.now() - startedAt >= BUDGET_MS) break;
        const job = await queue.claim([...JOB_TYPES], workerId);
        if (!job) break;
        claimedInBatch++;
        processed++;

        const handler = HANDLERS[job.type];
        if (!handler) {
          // Honest failure: unknown types land in the DLQ (visible in the admin
          // panel) instead of silently sitting queued forever.
          await stampJobMetrics(admin, job.id, 0);
          await queue.fail(job.id, {
            status: 422,
            message: `handler not implemented for ${job.type}`,
          });
          failedNoHandler++;
          continue;
        }
        fireAndForget(handler.fn, handler.body(job));
        dispatched++;
      }
      if (claimedInBatch === 0) break; // queue drained
    }

    logEvent({
      requestId,
      operation: "process-jobs",
      status: "ok",
      workerId,
      durationMs: Date.now() - startedAt,
      processed,
      dispatched,
      failedNoHandler,
    });
    return json({ processed, dispatched, failedNoHandler }, 200, {}, req);
  } catch (err) {
    logEvent({
      requestId,
      operation: "process-jobs",
      status: "error",
      durationMs: Date.now() - startedAt,
      processed,
      error: err instanceof Error ? err.message : String(err),
    });
    return new AppError("INTERNAL_ERROR", "Erro interno.").toResponse(requestId, req);
  }
});
