// Testes REAIS de membership hardening das RPCs — contra Postgres + grants.
// Fase 1 Security Remediation (P0-1 e P0-2), migration
// 20260815000011_rpc_membership_hardening.sql.
//
// Cenários (espelho dos cenários que exigem banco do handoff-spec):
//   * anon não pode chamar get_search_discovery;
//   * usuário da org B não lê search da org A (search_id conhecido);
//   * ex-membro (membership removida) não lê mais;
//   * p_organization_id manipulado não concede acesso;
//   * caminho autorizado continua funcionando (não-regressão);
//   * anon não pode chamar increment_usage_counter;
//   * p_quantity negativa / excessiva é rejeitada (22023);
//   * período invertido é rejeitado (22023);
//   * caminho autorizado (service_role) continua incrementando com upsert
//     atômico.
//
// AUTO-SKIP: mesma convenção de rls-isolation.test.ts — sem Supabase local
// acessível, a suíte é PULADA em vez de falhar (o gate de CI não tem banco).
// Para rodar de verdade:
//   supabase start && supabase migration up --local && bun test
//
// As credenciais abaixo são as chaves de DEMO fixas do Supabase local (as
// mesmas que `supabase status` imprime em qualquer máquina). Não são segredo
// e não servem para nada fora de 127.0.0.1.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const API_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function isReachable(): Promise<boolean> {
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

const available = await isReachable();
const requireDatabase = process.env.REQUIRE_RLS_DB === "true";

if (!available && requireDatabase) {
  throw new Error(
    `[rpc-membership-hardening] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    `[rpc-membership-hardening] Supabase local não acessível em ${API_URL} — suíte PULADA. ` +
      `Rode 'supabase start && supabase migration up --local' para executá-la.`,
  );
}

// Sufixo único por execução para não colidir com dados já existentes no banco
// local de desenvolvimento (estes testes NÃO resetam o banco).
const RUN = Math.random().toString(36).slice(2, 10);

interface Actor {
  userId: string;
  email: string;
  organizationId: string;
  client: SupabaseClient;
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function createActor(label: string): Promise<Actor> {
  const email = `rpc-${label}-${RUN}@radar.test`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Rpc ${label}`, company_name: `Rpc ${label} ${RUN}` },
  });
  if (createError) throw new Error(`createUser(${label}): ${createError.message}`);
  const userId = created.user!.id;

  const { data: memberships, error: memberError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  if (memberError) throw new Error(`memberships(${label}): ${memberError.message}`);
  const organizationId = memberships?.[0]?.organization_id as string;
  if (!organizationId) {
    throw new Error(`handle_new_user() não criou organização para ${label}`);
  }

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  return { userId, email, organizationId, client };
}

describeIfDb("rpc membership hardening (get_search_discovery + increment_usage_counter)", () => {
  let orgA: Actor;
  let orgB: Actor;
  let orgC: Actor;
  let searchIdA: string;
  let placeIdA: string;

  beforeAll(async () => {
    orgA = await createActor("a");
    orgB = await createActor("b");
    orgC = await createActor("c");

    // Busca da org A criada pelo próprio usuário A (escrita legítima passa).
    // Já nasce como missão salva — fixture dos cenários de get_saved_searches.
    const { data: search, error: searchError } = await orgA.client
      .from("searches")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        query: `busca-rpc-${RUN}`,
        location_label: "Belo Horizonte, MG",
        center: "SRID=4326;POINT(-43.9386 -19.9208)",
        radius_meters: 5000,
        is_saved: true,
        saved_name: `Missão Confidencial ${RUN}`,
      })
      .select("id")
      .single();
    if (searchError) throw new Error(`insert search A: ${searchError.message}`);
    searchIdA = search.id;

    // Place com PII de contato (o alvo do vazamento P0-1), via service_role.
    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        organization_id: orgA.organizationId,
        provider: "google_places",
        provider_place_id: `plc-rpc-${RUN}-a`,
        name: `Alvo Confidencial RPC ${RUN}`,
        location: "SRID=4326;POINT(-43.9386 -19.9208)",
        email: `contato-${RUN}@segredo.test`,
        instagram: `@segredo_${RUN}`,
        whatsapp: "+5531999999999",
        enrichment_state: "enriched",
      })
      .select("id")
      .single();
    if (placeError) throw new Error(`insert place A: ${placeError.message}`);
    placeIdA = place.id;

    // Resultado da busca apontando para o place, via service_role.
    const { error: resultError } = await admin.from("search_results").insert({
      search_id: searchIdA,
      place_id: placeIdA,
      distance_meters: 42,
      is_inside_radius: true,
      score: 90,
      temperature: "hot",
    });
    if (resultError) throw new Error(`insert search_result A: ${resultError.message}`);
  });

  afterAll(async () => {
    // P1-f: organizations.owner_user_id NÃO cascateia de auth.users — apagar
    // a org ANTES do usuário para não acumular fixtures.
    for (const actor of [orgA, orgB, orgC]) {
      if (!actor?.userId) continue;
      try {
        await admin.from("organizations").delete().eq("owner_user_id", actor.userId);
      } catch {
        /* melhor esforço */
      }
      try {
        await admin.auth.admin.deleteUser(actor.userId);
      } catch {
        /* melhor esforço */
      }
    }
  });

  // ── get_search_discovery: autorização ────────────────────────────────────

  test("RPC-001: anon não pode chamar get_search_discovery (sem EXECUTE)", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await anon.rpc("get_search_discovery", { p_search_id: searchIdA });
    expect(error).not.toBeNull();
  });

  test("RPC-002: membro da org A lê a própria descoberta (não-regressão)", async () => {
    const { data, error } = await orgA.client.rpc("get_search_discovery", {
      p_search_id: searchIdA,
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows.some((r) => r.place_id === placeIdA)).toBe(true);
    const row = rows.find((r) => r.place_id === placeIdA)!;
    expect(row.email).toBe(`contato-${RUN}@segredo.test`);
    expect(row.instagram).toBe(`@segredo_${RUN}`);
    expect(row.whatsapp).toBe("+5531999999999");
  });

  test("RPC-003: usuário da org B não lê search da org A (search_id conhecido)", async () => {
    const { data, error } = await orgB.client.rpc("get_search_discovery", {
      p_search_id: searchIdA,
    });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("RPC-004: p_organization_id manipulado (org A) não concede acesso a B", async () => {
    const { data, error } = await orgB.client.rpc("get_search_discovery", {
      p_search_id: searchIdA,
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("RPC-005: p_organization_id é filtro, não autorização — membro de A com org id de B não vê nada", async () => {
    const { data, error } = await orgA.client.rpc("get_search_discovery", {
      p_search_id: searchIdA,
      p_organization_id: orgB.organizationId,
    });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("RPC-006: membro adicionado à org A lê; ex-membro não lê mais", async () => {
    // Adiciona C à org A via service_role.
    const { error: insertError } = await admin.from("organization_members").insert({
      organization_id: orgA.organizationId,
      user_id: orgC.userId,
      role: "member",
    });
    expect(insertError).toBeNull();

    const { data: asMember, error: memberError } = await orgC.client.rpc("get_search_discovery", {
      p_search_id: searchIdA,
    });
    expect(memberError).toBeNull();
    expect((asMember ?? []).some((r: { place_id: string }) => r.place_id === placeIdA)).toBe(true);

    // Remove a membership (C continua membro da própria org C).
    const { error: deleteError } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgA.organizationId)
      .eq("user_id", orgC.userId);
    expect(deleteError).toBeNull();

    const { data: asExMember, error: exMemberError } = await orgC.client.rpc(
      "get_search_discovery",
      { p_search_id: searchIdA },
    );
    expect(exMemberError).toBeNull();
    expect(asExMember ?? []).toEqual([]);
  });

  // ── get_saved_searches: autorização (Fase 1b) ───────────────────────────

  test("RPC-013: usuário da org B não vê missões salvas da org A", async () => {
    const { data, error } = await orgB.client.rpc("get_saved_searches", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("RPC-014: membro adicionado à org A vê missões; ex-membro não vê mais", async () => {
    const { error: insertError } = await admin.from("organization_members").insert({
      organization_id: orgA.organizationId,
      user_id: orgC.userId,
      role: "member",
    });
    expect(insertError).toBeNull();

    const { data: asMember, error: memberError } = await orgC.client.rpc("get_saved_searches", {
      p_organization_id: orgA.organizationId,
    });
    expect(memberError).toBeNull();
    expect(
      (asMember ?? []).some(
        (r: { saved_name: string }) => r.saved_name === `Missão Confidencial ${RUN}`,
      ),
    ).toBe(true);

    const { error: deleteError } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", orgA.organizationId)
      .eq("user_id", orgC.userId);
    expect(deleteError).toBeNull();

    const { data: asExMember, error: exMemberError } = await orgC.client.rpc("get_saved_searches", {
      p_organization_id: orgA.organizationId,
    });
    expect(exMemberError).toBeNull();
    expect(asExMember ?? []).toEqual([]);
  });

  test("RPC-015: membro da org A vê as próprias missões salvas (não-regressão)", async () => {
    const { data, error } = await orgA.client.rpc("get_saved_searches", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows.length).toBe(1);
    expect(rows[0].saved_name).toBe(`Missão Confidencial ${RUN}`);
    expect(rows[0].query).toBe(`busca-rpc-${RUN}`);
    expect(rows[0].total_results).toBe(1); // search_result semeado no beforeAll
  });

  // ── increment_usage_counter: grants + validação ──────────────────────────

  const validIncrement = {
    p_organization_id: () => orgA.organizationId,
    p_metric: `metric-rpc-${RUN}`,
    p_period_start: "2026-08-01",
    p_period_end: "2026-08-31",
    p_quantity: 3,
  };

  test("RPC-007: anon não pode chamar increment_usage_counter (sem EXECUTE)", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await anon.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
    });
    expect(error).not.toBeNull();
  });

  test("RPC-008: authenticated não pode chamar increment_usage_counter (internal-only)", async () => {
    const { error } = await orgA.client.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
    });
    expect(error).not.toBeNull();
  });

  test("RPC-009: p_quantity negativa é rejeitada (22023)", async () => {
    const { error } = await admin.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
      p_quantity: -1,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
  });

  test("RPC-010: p_quantity acima do teto é rejeitada (22023)", async () => {
    const { error } = await admin.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
      p_quantity: 1_000_001,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
  });

  test("RPC-011: p_period_end < p_period_start é rejeitado (22023)", async () => {
    const { error } = await admin.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
      p_period_start: "2026-08-31",
      p_period_end: "2026-08-01",
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
  });

  test("RPC-012: caminho autorizado (service_role) incrementa com upsert atômico", async () => {
    const { error: firstError } = await admin.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
      p_quantity: 3,
    });
    expect(firstError).toBeNull();

    const { error: secondError } = await admin.rpc("increment_usage_counter", {
      ...validIncrement,
      p_organization_id: orgA.organizationId,
      p_quantity: 2,
    });
    expect(secondError).toBeNull();

    const { data: counter, error: readError } = await admin
      .from("usage_counters")
      .select("quantity")
      .eq("organization_id", orgA.organizationId)
      .eq("metric", validIncrement.p_metric)
      .eq("period_start", validIncrement.p_period_start)
      .single();
    expect(readError).toBeNull();
    expect(counter?.quantity).toBe(5);
  });

  // ── Fase 1c: funções globais internal-only (ACL) ─────────────────────────
  // Varredura completa no banco local (has_function_privilege) fechou a classe:
  // as purges/sweeper/custo são security definer sem escopo de organização e
  // NÃO podem ser executadas por authenticated. service_role (edge functions /
  // pg_cron roda como postgres) segue liberado.

  test("RPC-016: authenticated não pode chamar purge_stale_discovery_pii (P0)", async () => {
    const { error } = await orgA.client.rpc("purge_stale_discovery_pii");
    expect(error).not.toBeNull();
  });

  test("RPC-017: authenticated não pode chamar purge_rate_limit_events", async () => {
    const { error } = await orgA.client.rpc("purge_rate_limit_events");
    expect(error).not.toBeNull();
  });

  test("RPC-018: authenticated não pode chamar purge_error_events", async () => {
    const { error } = await orgA.client.rpc("purge_error_events");
    expect(error).not.toBeNull();
  });

  test("RPC-019: authenticated não pode chamar recover_stuck_jobs", async () => {
    const { error } = await orgA.client.rpc("recover_stuck_jobs");
    expect(error).not.toBeNull();
  });

  test("RPC-020: authenticated não pode chamar org_mtd_api_cost_usd", async () => {
    const { error } = await orgA.client.rpc("org_mtd_api_cost_usd", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).not.toBeNull();
  });

  test("RPC-021: authenticated não pode chamar purge_stale_discovery_google_content (varredura)", async () => {
    const { error } = await orgA.client.rpc("purge_stale_discovery_google_content");
    expect(error).not.toBeNull();
  });

  test("RPC-022: service_role pode chamar purge_stale_discovery_pii (pg_cron/cron path)", async () => {
    const { data, error } = await admin.rpc("purge_stale_discovery_pii");
    expect(error).toBeNull();
    expect(typeof data).toBe("number"); // retorna a contagem de linhas expurgadas
  });

  test("RPC-023: service_role pode chamar recover_stuck_jobs", async () => {
    const { error } = await admin.rpc("recover_stuck_jobs");
    expect(error).toBeNull();
  });

  test("RPC-024: service_role pode chamar org_mtd_api_cost_usd", async () => {
    const { data, error } = await admin.rpc("org_mtd_api_cost_usd", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("number");
  });

  test("RPC-025: service_role pode chamar purge_rate_limit_events e purge_error_events", async () => {
    const { data: rl, error: rlError } = await admin.rpc("purge_rate_limit_events");
    expect(rlError).toBeNull();
    expect(typeof rl).toBe("number");

    const { data: ee, error: eeError } = await admin.rpc("purge_error_events");
    expect(eeError).toBeNull();
    expect(typeof ee).toBe("number");
  });
});
