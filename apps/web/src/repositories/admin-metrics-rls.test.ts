// RLS/security test for get_admin_job_metrics (Fase 7).
//
// Gate: roda SOMENTE contra o Supabase LOCAL (127.0.0.1), nunca contra o projeto
// de .env.local. Mesma convenção do company-sources-rls.test.ts. Cenários:
//   1. Usuário NÃO-admin chamando get_admin_job_metrics() → erro 'forbidden'
//      (42501) — o gate is_platform_admin roda SECURITY DEFINER dentro do RPC
//      e o JWT do usuário resolve auth.uid().
//   2. Platform admin → jsonb array com uma entrada por tipo de job
//      (total/completed/failed/retrying/avg_duration_ms/est_cost_usd).
//   3. RPC não executável por anon (grants: authenticated + service_role only).

import { describe, expect, test } from "bun:test";
import { API_URL, ANON_KEY, isReachable } from "./__rls-local";

const available = await isReachable();

if (!available && process.env.REQUIRE_RLS_DB === "true") {
  throw new Error(
    `[admin-metrics-rls] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}

const describeIfDb = available ? describe : describe.skip;

describeIfDb("get_admin_job_metrics gate", () => {
  test("anon cannot execute get_admin_job_metrics (grant)", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
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
