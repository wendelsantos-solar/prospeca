// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
//
// Also persists errors to `error_events` via Supabase for production
// observability (beta error tracking, zero vendor dependencies).

import { getSupabase } from "./supabase";
import { isRealMode } from "./env";

const RELEASE = import.meta.env.VITE_APP_RELEASE ?? "unknown";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

// --- Client-side error persistence ---

export interface ClientErrorContext {
  location: string;
  organizationId?: string;
  context?: Record<string, unknown>;
}

function sanitizeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error (non-serializable)";
  }
}

function sanitizeStack(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) {
    const lines = err.stack.split("\n");
    return lines.slice(0, 6).join("\n");
  }
  return undefined;
}

/**
 * Capture a client-side error and persist to error_events.
 * Fire-and-forget — never throws, never blocks the UI.
 *
 * Call directly from try/catch in event handlers, effects, and async code.
 * The ErrorBoundary calls this automatically for render errors.
 */
export function captureClientError(err: unknown, ctx: ClientErrorContext): void {
  if (!isRealMode) {
    console.warn("[error-capture]", ctx.location, sanitizeMessage(err));
    return;
  }

  // Fire-and-forget: não bloqueia a UI.
  void (async () => {
    try {
      const supabase = getSupabase();

      // Resolve organizationId se não fornecido: tenta pegar do contexto atual.
      let orgId = ctx.organizationId ?? null;
      if (!orgId) {
        try {
          const { data: memberships } = await supabase
            .from("organization_members")
            .select("organization_id")
            .order("created_at", { ascending: true })
            .limit(1);
          if (memberships?.length) {
            orgId = memberships[0].organization_id;
          }
        } catch {
          // Se a query de membership falhar (ex: offline), segue com null.
        }
      }

      const { error: insertError } = await supabase.from("error_events").insert({
        source: "browser",
        location: ctx.location,
        message: sanitizeMessage(err),
        stack: sanitizeStack(err),
        severity: "error",
        context: ctx.context ?? null,
        organization_id: orgId,
        release: RELEASE,
        environment: import.meta.env.MODE === "production" ? "production" : "development",
        user_agent: navigator.userAgent.slice(0, 512),
      });

      if (insertError) {
        console.warn("[error-capture] falha ao persistir:", ctx.location, insertError.message);
      }
    } catch (doubleFault) {
      // Last resort: if even error tracking fails, log to console.
      console.error("[error-capture] double fault:", doubleFault);
    }
  })();
}
