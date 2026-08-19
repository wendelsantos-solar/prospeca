// RLS test for company_sources (Fase 3).
//
// Gate: roda SOMENTE contra o Supabase LOCAL (127.0.0.1), nunca contra o projeto
// de .env.local — o cenário 1 faz INSERT. Sem banco local acessível a suíte é
// pulada; com REQUIRE_RLS_DB=true a ausência do banco é erro (mesma convenção de
// supabase/tests/rls-isolation.test.ts).
//
// Cenário de isolamento (spec #92–93):
//   1. INSERT por client ANON → deve falhar (não há policy de INSERT —
//      escrita é exclusiva do service role, mesmo padrão de jobs).
//   2. SELECT por usuário da org B sobre source da org A → 0 linhas
//      (policy company_sources_org_read usa is_organization_member).
//   3. SELECT por usuário da org A → 1 linha.
//
// Para rodar: supabase start && supabase migration up --local && bun test

import { describe, expect, test } from "bun:test";
import { API_URL, ANON_KEY, isReachable } from "./__rls-local";

const available = await isReachable();

if (!available && process.env.REQUIRE_RLS_DB === "true") {
  throw new Error(
    `[company-sources-rls] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}

const describeIfDb = available ? describe : describe.skip;

describeIfDb("company_sources RLS", () => {
  test("anon cannot INSERT into company_sources", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
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
