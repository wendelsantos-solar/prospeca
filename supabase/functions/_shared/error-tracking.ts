// Error tracking abstraction — Sentry integration with zero-vendor fallback.
//
// When SENTRY_DSN is configured, errors are forwarded to Sentry.
// When absent, errors are logged as structured JSON (consumed by error-digest cron).
// The interface never changes — callers don't branch on configuration.
//
// Setup: docs/OBSERVABILITY.md (or docs/SENTRY_SETUP.md once created)

const SENTRY_DSN = Deno.env.get("SENTRY_DSN");
const RELEASE = Deno.env.get("APP_RELEASE") ?? Deno.env.get("APP_VERSION") ?? "unknown";
const ENVIRONMENT = Deno.env.get("APP_ENV") ?? "development";

interface ErrorContext {
  location: string;
  requestId?: string;
  organizationId?: string;
  userId?: string;
  extra?: Record<string, unknown>;
}

function sentryEnabled(): boolean {
  return !!SENTRY_DSN;
}

interface SentryEvent {
  event_id: string;
  timestamp: string;
  level: "error" | "fatal" | "warning";
  logger: string;
  platform: string;
  environment: string;
  release: string;
  transaction: string;
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
        }>;
      };
    }>;
  };
  contexts: {
    runtime: { name: string; version: string };
    app?: {
      location: string;
      requestId?: string;
      organizationId?: string;
    };
  };
  user?: {
    id: string;
  };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
}

function buildSentryEvent(err: unknown, context: ErrorContext, requestId: string): SentryEvent {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  const frames: SentryEvent["exception"]["values"][0]["stacktrace"]["frames"] = [];
  if (stack) {
    const lines = stack.split("\n").slice(1, 11); // top 10 frames
    for (const line of lines) {
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
      if (match) {
        frames.push({
          filename: match[2] ?? "unknown",
          function: match[1] ?? "<anonymous>",
          lineno: parseInt(match[3] ?? "0", 10),
        });
      }
    }
  }

  return {
    event_id: requestId,
    timestamp: new Date().toISOString(),
    level: "error",
    logger: "edge-function",
    platform: "deno",
    environment: ENVIRONMENT,
    release: RELEASE,
    transaction: context.location,
    message,
    exception: message
      ? {
          values: [
            {
              type: err instanceof Error ? err.constructor.name : "Error",
              value: message,
              stacktrace: frames.length > 0 ? { frames } : undefined,
            },
          ],
        }
      : undefined,
    contexts: {
      runtime: { name: "deno", version: Deno.version.deno },
      app: {
        location: context.location,
        requestId: context.requestId,
        organizationId: context.organizationId,
      },
    },
    user: context.userId ? { id: context.userId } : undefined,
    tags: {
      location: context.location,
      environment: ENVIRONMENT,
    },
    extra: {
      ...context.extra,
      organizationId: context.organizationId,
    },
  };
}

/**
 * Captures an error for observability. In production with Sentry configured,
 * forwards to Sentry. Always logs as structured JSON so error-digest can
 * aggregate even when Sentry is unreachable.
 *
 * Fire-and-forget: never throws, never blocks the caller.
 */
export function captureError(err: unknown, context: ErrorContext): void {
  const requestId = context.requestId ?? crypto.randomUUID();

  // Always log structured error for error-digest (zero-vendor fallback)
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "capture_error",
      requestId,
      location: context.location,
      organizationId: context.organizationId,
      error: err instanceof Error ? err.message : String(err),
      stack:
        err instanceof Error ? (err.stack ?? "").split("\n").slice(0, 6).join("\n") : undefined,
    }),
  );

  // Forward to Sentry when configured
  if (sentryEnabled()) {
    const event = buildSentryEvent(err, context, requestId);
    void sendToSentry(event);
  }
}

async function sendToSentry(event: SentryEvent): Promise<void> {
  if (!SENTRY_DSN) return;

  try {
    const dsn = new URL(SENTRY_DSN);
    const projectId = dsn.pathname.replace("/", "");
    const publicKey = dsn.username;
    const endpoint = `https://${dsn.hostname}/api/${projectId}/store/`;

    const envelope = JSON.stringify({
      sent_at: new Date().toISOString(),
      ...event,
    });

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=prospeca/1.0`,
      },
      body: envelope,
    });
  } catch {
    // Sentry itself is unavailable — the structured log above already
    // captured the error for the error-digest cron. Do nothing further.
  }
}

/**
 * Captures an error and returns a 500 Response. Use as the catch-all in
 * edge function handlers. The error-digest cron will aggregate these.
 *
 * Prefer `http.captureAndRespond()` for the full pattern (calls this fn).
 */
export function captureErrorAndLog(err: unknown, context: ErrorContext): void {
  captureError(err, context);
}
