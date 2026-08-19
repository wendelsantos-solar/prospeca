// dispatch: fire-and-forget internal invocation of another edge function,
// with retries. The transport for async post-search work (score-company,
// territory-analysis, the job worker) is functions.invoke chaining — ADR-001
// (no Redis/BullMQ). The caller is always the service role, so the target
// function MUST accept internal calls (isInternalCall) and validate org
// context from the body.
//
// Same pattern as create-search's trigger of execute-search: a bare
// fire-and-forget fetch can be dropped when the runtime returns before the
// request is sent, so we use EdgeRuntime.waitUntil + a few retries.
import { logEvent } from "./http.ts";

export interface DispatchOptions {
  retries?: number;
  /** Extra headers (e.g. idempotency). */
  headers?: Record<string, string>;
}

/** Fire an internal (service-role) edge function call without awaiting it. */
export function fireAndForget(fnName: string, body: unknown, opts: DispatchOptions = {}): void {
  const retries = opts.retries ?? 3;
  const dispatch = (async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fnName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            ...(opts.headers ?? {}),
          },
          body: JSON.stringify(body),
        });
        return; // reached the target; it owns the rest (idempotent on re-entry)
      } catch {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    logEvent({ operation: `dispatch:${fnName}`, status: "error", errorCode: "DISPATCH_FAILED" });
  })();
  const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (edge?.waitUntil) edge.waitUntil(dispatch);
  else void dispatch;
}
