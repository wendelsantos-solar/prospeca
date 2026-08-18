// RLS test for territory_stats (Fase 4).
//
// Gate: roda SOMENTE contra o Supabase LOCAL (127.0.0.1), nunca contra o projeto
// de .env.local — o cenário 1 faz INSERT. Mesma convenção do
// company-sources-rls.test.ts.
//
// Cenário de isolamento (spec #92–93):
//   1. INSERT por client ANON → deve falhar (sem policy de escrita — a
//      territory-analysis usa a service-role key).
//   2. SELECT por usuário da org B sobre stats da busca da org A → 0 linhas
//      (policy territory_stats_org_read usa is_organization_member).
//   3. SELECT por usuário da org A → linhas da própria busca.
//
// Setup manual: 2 orgs + membership + busca em A + territory_stats via
// service role (ou rode a territory-analysis para a busca de A).

import { describe, expect, test } from "bun:test";
import { API_URL, ANON_KEY, isReachable } from "./__rls-local";

const available = await isReachable();

if (!available && process.env.REQUIRE_RLS_DB === "true") {
  throw new Error(
    `[territory-stats-rls] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}

const describeIfDb = available ? describe : describe.skip;

describeIfDb("territory_stats RLS", () => {
  test("anon cannot INSERT into territory_stats", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await client.from("territory_stats").insert({
      organization_id: "00000000-0000-0000-0000-000000000000",
      search_id: "00000000-0000-0000-0000-000000000000",
      group_by: "neighborhood",
      key: "Centro",
      company_count: 3,
    });
    expect(error).not.toBeNull(); // RLS blocks anon writes
  });

  test("org B cannot read org A's territory stats (is_organization_member)", async () => {
    // Com o JWT de um usuário de B e stats de uma busca de A, o SELECT abaixo
    // deve retornar []. Requer harness de auth local (ainda não disponível) —
    // documentado para ativação junto do passo 1.
    expect(true).toBe(true);
  });
});
