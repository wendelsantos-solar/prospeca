// Error tracking — shared reporter for edge functions.
//
// Usage (in any edge function):
//   import { captureError, captureWarning } from "../_shared/error-tracking.ts";
//
//   try { ... } catch (err) {
//     captureError(err, { location: "execute-search", requestId, organizationId });
//     return new AppError("INTERNAL_ERROR", "...").toResponse(requestId, req);
//   }
//
// What is NEVER captured (sanitization by construction):
//   - Request bodies, headers, tokens, API keys
//   - PII (emails, phone numbers, names)
//   - Full error objects (only message + stack, never the whole thing)
//
// What IS captured:
//   - Error message + stack trace
//   - Location (function name)
//   - Request ID (for log correlation)
//   - Organization ID (nullable — pre-org errors are valid)
//   - Release (git hash or version)
//   - Environment (development/staging/production)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELEASE =
  Deno.env.get("APP_RELEASE") ?? Deno.env.get("VERCEL_GIT_COMMIT_SHA")?.slice(0, 7) ?? "unknown";
const ENVIRONMENT = Deno.env.get("APP_ENV") ?? "production";

// Lazy singleton — só inicializa quando o primeiro erro acontece.
let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _admin;
}

export interface ErrorContext {
  location: string;
  requestId?: string;
  organizationId?: string;
  /** Structured context — only keys that carry no PII: code, status, endpoint, operation, etc. */
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
    // Keep only first 5 frames — enough to identify the bug, not enough to leak
    // sensitive data that might be in deeper frames.
    const lines = err.stack.split("\n");
    return lines.slice(0, 6).join("\n");
  }
  return undefined;
}

async function persistError(
  severity: "error" | "warn",
  err: unknown,
  ctx: ErrorContext,
): Promise<void> {
  try {
    const admin = adminClient();
    const errorEvent = {
      source: "edge-function",
      location: ctx.location,
      message: sanitizeMessage(err),
      stack: sanitizeStack(err),
      severity,
      context: ctx.context ?? null,
      request_id: ctx.requestId ?? null,
      organization_id: ctx.organizationId ?? null,
      release: RELEASE,
      environment: ENVIRONMENT,
      user_agent: null,
    };
    // This module deliberately does not import a generated Database type. The
    // Supabase client therefore infers inserts as `never`; the payload is still
    // fully explicit above and checked by Postgres at the persistence seam.
    const { error: insertError } = await admin.from("error_events").insert(errorEvent as never);

    if (insertError) {
      // Last resort: log to console so at least the function logs capture it.
      console.error(
        JSON.stringify({
          event: "error_tracking_failed",
          severity,
          location: ctx.location,
          reason: insertError.message,
          original_message: sanitizeMessage(err),
        }),
      );
    }
  } catch (doubleFault) {
    // If even error tracking fails, log and move on. Never throw from here.
    console.error(
      JSON.stringify({
        event: "error_tracking_double_fault",
        severity,
        location: ctx.location,
        reason: sanitizeMessage(doubleFault),
      }),
    );
  }
}

/**
 * Capture an unexpected error. Fire-and-forget — never throws.
 * Call this inside your catch block BEFORE returning the error response.
 */
export function captureError(err: unknown, ctx: ErrorContext): void {
  // Fire-and-forget: não bloqueia a resposta para o cliente.
  void persistError("error", err, ctx).catch(() => {
    // swallow — double fault already logged inside persistError
  });
}

/**
 * Capture a degraded-but-functional condition (e.g., provider timeout,
 * quota exceeded but serving stale cache). Fire-and-forget.
 */
export function captureWarning(err: unknown, ctx: ErrorContext): void {
  void persistError("warn", err, ctx).catch(() => {
    // swallow
  });
}
