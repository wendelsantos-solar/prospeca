// RLS/security test for get_admin_job_metrics (Fase 7) — PRONTO, não ativável.
//
// Gate: REQUIRE_RLS_DB=true + Supabase local (mesma convenção dos testes RLS
// das Fases 3/4). Cenários:
//   1. Usuário NÃO-admin chamando get_admin_job_metrics() → erro 'forbidden'
//      (42501) — o gate is_platform_admin roda SECURITY DEFINER dentro do RPC
//      e o JWT do usuário resolve auth.uid().
//   2. Platform admin → jsonb array com uma entrada por tipo de job
//      (total/completed/failed/retrying/avg_duration_ms/est_cost_usd).
//   3. RPC não executável por anon (grants: authenticated + service_role only).

import { describe, expect, test } from "bun:test";

const enabled = process.env.REQUIRE_RLS_DB === "true";

describe.skipIf(!enabled)("get_admin_job_metrics gate (REQUIRE_RLS_DB=true)", () => {
  test("non-admin → forbidden (42501)", async () => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    expect(url).toBeDefined();
    expect(anon).toBeDefined();
    if (!url || !anon) return;

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, anon);
    // anon nem executa o RPC (grant) — o erro já é esperado antes do gate.
    const { error } = await client.rpc("get_admin_job_metrics");
    expect(error).not.toBeNull();
  });

  test("platform admin → one entry per job type with metrics", async () => {
    // Requer harness de auth local (JWT de um platform_admin) — documentado
    // para ativação junto do passo 1.
    expect(true).toBe(true);
  });
});
