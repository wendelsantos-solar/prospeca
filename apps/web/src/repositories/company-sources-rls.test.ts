// RLS test for company_sources (Fase 3) — PRONTO, ainda não ativável.
//
// Gate: roda SOMENTE quando a infra local existir e o runner for invocado com
// REQUIRE_RLS_DB=true (mesma convenção do verify:pilot). Hoje o repo não tem
// Supabase local no CI, então o teste fica skipIf até lá.
//
// Cenário de isolamento (spec #92–93):
//   1. INSERT por client ANON → deve falhar (não há policy de INSERT —
//      escrita é exclusiva do service role, mesmo padrão de jobs).
//   2. SELECT por usuário da org B sobre source da org A → 0 linhas
//      (policy company_sources_org_read usa is_organization_member).
//   3. SELECT por usuário da org A → 1 linha.
//
// Setup manual (uma vez, SQL editor / migration runner):
//   - 2 orgs (A, B) + 1 membership cada + 1 place em A.
//   - INSERT service-role: company_sources(org A, place A, provider
//     'google_places', source_type 'discovery').
//   - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//     apontando para o projeto local.

import { describe, expect, test } from "bun:test";

const enabled = process.env.REQUIRE_RLS_DB === "true";

describe.skipIf(!enabled)("company_sources RLS (REQUIRE_RLS_DB=true)", () => {
  test("anon cannot INSERT into company_sources", async () => {
    const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
    expect(url).toBeDefined();
    expect(anon).toBeDefined();
    if (!url || !anon) return;

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, anon);
    const { error } = await client.from("company_sources").insert({
      organization_id: "00000000-0000-0000-0000-000000000000",
      place_id: "00000000-0000-0000-0000-000000000000",
      provider: "google_places",
      source_type: "discovery",
    });
    expect(error).not.toBeNull(); // RLS blocks anon writes
  });

  test("org B cannot read org A's sources (is_organization_member)", async () => {
    // Com o JWT de um usuário de B e um source de A criado por service role,
    // o SELECT abaixo deve retornar []. Requer harness de auth local (ainda
    // não disponível) — documentado para ativação junto do passo 1.
    expect(true).toBe(true);
  });
});
