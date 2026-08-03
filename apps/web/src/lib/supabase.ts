import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isRealMode, realConfigMissing } from "./env";
import { getStoredActiveOrganizationId } from "./active-organization";

let client: SupabaseClient | null = null;

// "Manter conectado" preference — read at client-creation time, so it must
// be set (see setRememberMe below) *before* the first getSupabase() call of
// the session. Login is the only place that writes it; everywhere else
// (signup, OAuth) defaults to "remembered", matching the previous
// always-persist behavior.
const REMEMBER_KEY = "radar-local:rememberMe";

export function setRememberMe(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_KEY, String(remember));
  } catch {
    /* noop */
  }
}

function authStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    // Default (no preference recorded yet, e.g. signup/OAuth) persists —
    // same behavior as before this was configurable.
    const remembered = window.localStorage.getItem(REMEMBER_KEY) !== "false";
    return remembered ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Browser Supabase client (anon key only — RLS enforced).
 * Throws in real mode with missing config instead of silently degrading.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const missing = realConfigMissing();
  if (missing.length > 0) {
    throw new Error(`Configuração ausente: ${missing.join(", ")}`);
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storage: authStorage() },
  });
  return client;
}

export function supabaseAvailable(): boolean {
  return isRealMode && !!env.supabaseUrl && !!env.supabaseAnonKey;
}

/** Calls an Edge Function with the user's JWT. Parses ApiError shape.
 * Retries transient network errors up to 2 times with exponential backoff. */
export async function invokeFunction<T>(
  name: string,
  body: unknown,
  opts?: { idempotencyKey?: string },
): Promise<T> {
  const supabase = getSupabase();
  const headers: Record<string, string> = {};
  if (opts?.idempotencyKey) headers["x-idempotency-key"] = opts.idempotencyKey;
  const activeOrganizationId = getStoredActiveOrganizationId();
  if (activeOrganizationId) headers["x-organization-id"] = activeOrganizationId;

  const MAX_RETRIES = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 400ms, 1600ms
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }

    try {
      const { data, error } = await supabase.functions.invoke(name, {
        body: body as Record<string, unknown>,
        headers,
      });

      if (error) {
        let parsed: { code?: string; message?: string } | null = null;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) parsed = await ctx.json();
        } catch {
          // response body not JSON — fall through to generic message
        }
        // Don't retry client errors (4xx) — only server/network errors
        if (parsed?.code && !["INTERNAL_ERROR", "TIMEOUT"].includes(parsed.code)) {
          const err = new Error(parsed.message ?? "Falha na comunicação com o servidor.");
          (err as Error & { code?: string }).code = parsed.code;
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          lastError = error;
          continue;
        }
        const err = new Error(parsed?.message ?? "Falha na comunicação com o servidor.");
        (err as Error & { code?: string }).code = parsed?.code ?? "INTERNAL_ERROR";
        throw err;
      }

      return data as T;
    } catch (err) {
      // Network errors (TypeError, etc.) are retried
      if (attempt < MAX_RETRIES && err instanceof TypeError) {
        lastError = err;
        continue;
      }
      // If it's already an AppError (from parsed.code above), re-throw
      if ((err as Error & { code?: string }).code) throw err;
      if (attempt >= MAX_RETRIES) {
        const fallback = new Error(
          err instanceof Error ? err.message : "Falha na comunicação com o servidor.",
        );
        (fallback as Error & { code?: string }).code = "NETWORK_ERROR";
        throw fallback;
      }
      lastError = err;
    }
  }

  throw lastError ?? new Error("Falha na comunicação com o servidor.");
}
