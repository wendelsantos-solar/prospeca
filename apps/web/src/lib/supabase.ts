import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isRealMode, realConfigMissing } from "./env";

let client: SupabaseClient | null = null;

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
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export function supabaseAvailable(): boolean {
  return isRealMode && !!env.supabaseUrl && !!env.supabaseAnonKey;
}

/** Calls an Edge Function with the user's JWT. Parses ApiError shape. */
export async function invokeFunction<T>(
  name: string,
  body: unknown,
  opts?: { idempotencyKey?: string },
): Promise<T> {
  const supabase = getSupabase();
  const headers: Record<string, string> = {};
  if (opts?.idempotencyKey) headers["x-idempotency-key"] = opts.idempotencyKey;

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
    const err = new Error(parsed?.message ?? "Falha na comunicação com o servidor.");
    (err as Error & { code?: string }).code = parsed?.code ?? "INTERNAL_ERROR";
    throw err;
  }
  return data as T;
}
