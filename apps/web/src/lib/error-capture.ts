// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
//
// Also persists errors to `error_events` via Supabase for production
// observability (beta error tracking, zero vendor dependencies).
//
// Sentry integration: when VITE_SENTRY_DSN is set, errors are also forwarded
// to Sentry for real-time alerting. Without it, error_events + error-digest
// cron provide the zero-vendor fallback. See docs/OBSERVABILITY.md.

import { getSupabase } from "./supabase";
import { isRealMode } from "./env";

const RELEASE = import.meta.env.VITE_APP_RELEASE ?? "unknown";
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const sentryEnabled = !!SENTRY_DSN;

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

      // Forward to Sentry when configured (real-time alerting).
      if (sentryEnabled && SENTRY_DSN) {
        void sendToSentry(err, ctx, orgId);
      }
    } catch (doubleFault) {
      // Last resort: if even error tracking fails, log to console.
      console.error("[error-capture] double fault:", doubleFault);
    }
  })();
}

// ── Sentry transport (fire-and-forget, never blocks UI) ──────────────

async function sendToSentry(
  err: unknown,
  ctx: ClientErrorContext,
  organizationId: string | null,
): Promise<void> {
  if (!SENTRY_DSN) return;
  try {
    const message = err instanceof Error ? err.message : String(err);
    const dsn = new URL(SENTRY_DSN);
    const projectId = dsn.pathname.replace("/", "");
    const publicKey = dsn.username;
    const endpoint = `https://${dsn.hostname}/api/${projectId}/store/`;

    const event = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: "error",
      logger: "browser",
      platform: "javascript",
      environment: import.meta.env.MODE === "production" ? "production" : "development",
      release: RELEASE,
      transaction: ctx.location,
      message,
      exception: message
        ? {
            values: [
              {
                type: err instanceof Error ? err.constructor.name : "Error",
                value: message,
                stacktrace:
                  err instanceof Error && err.stack
                    ? { frames: parseStackFrames(err.stack) }
                    : undefined,
              },
            ],
          }
        : undefined,
      contexts: {
        browser: {
          name: navigator.userAgent.slice(0, 512),
        },
      },
      user: organizationId ? { id: organizationId } : undefined,
      tags: {
        location: ctx.location,
        environment: import.meta.env.MODE === "production" ? "production" : "development",
      },
      extra: {
        ...ctx.context,
        organizationId: organizationId ?? undefined,
      },
    };

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=prospeca-web/1.0`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Sentry unreachable — the error_events insert above already captured it.
  }
}

function parseStackFrames(stack: string): Array<{
  filename: string;
  function: string;
  lineno: number;
}> {
  return stack
    .split("\n")
    .slice(1, 11)
    .map((line) => {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
      return match
        ? {
            filename: match[2] ?? "unknown",
            function: match[1] ?? "<anonymous>",
            lineno: parseInt(match[3] ?? "0", 10),
          }
        : { filename: "unknown", function: "<anonymous>", lineno: 0 };
    })
    .filter((f) => f.filename !== "unknown" || f.lineno !== 0);
}
