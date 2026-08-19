// Convenção compartilhada dos testes de RLS que precisam de Supabase local.
//
// Mesma convenção de supabase/tests/rls-isolation.test.ts: o alvo é SEMPRE o
// Supabase local (127.0.0.1), nunca o projeto configurado em .env.local — estes
// testes fazem INSERT e não podem tocar produção. As chaves abaixo são as de
// DEMO fixas que `supabase status` imprime em qualquer máquina; não são segredo
// e não servem para nada fora de 127.0.0.1.

export const API_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";

export const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export async function isReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/rest/v1/`, {
      headers: { apikey: ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}
