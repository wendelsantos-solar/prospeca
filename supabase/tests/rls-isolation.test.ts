// Testes REAIS de isolamento cross-tenant, contra Postgres + RLS.
//
// Por que este arquivo existe: `packages/domain/src/isolation.test.ts` se chama
// "isolation" mas só exercita as funções puras de entitlement com dois objetos
// de plano em memória — nenhum banco, nenhuma policy, nenhuma tentativa real de
// acesso cruzado. Ele não prova isolamento nenhum. Estes testes provam: criam
// duas organizações de verdade, dois usuários de verdade, e o usuário da
// organização B tenta ler/inserir/atualizar/apagar dados da A pela mesma chave
// anon que o browser usa.
//
// AUTO-SKIP: se não houver Supabase local acessível, a suíte é pulada em vez de
// falhar — o gate de CI não tem banco. Para rodar de verdade:
//   supabase start && supabase migration up --local && bun test
//
// As credenciais abaixo são as chaves de DEMO fixas do Supabase local (as mesmas
// que `supabase status` imprime em qualquer máquina). Não são segredo e não
// servem para nada fora de 127.0.0.1.

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
    `[rls-isolation] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    `[rls-isolation] Supabase local não acessível em ${API_URL} — suíte PULADA. ` +
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

/**
 * Cria usuário confirmado + resolve a organização que `handle_new_user()`
 * criou para ele, e devolve um client autenticado como esse usuário (chave
 * anon + JWT — exatamente o caminho do browser, com RLS valendo).
 */
async function createActor(label: string): Promise<Actor> {
  const email = `iso-${label}-${RUN}@radar.test`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Org ${label}`, company_name: `Org ${label} ${RUN}` },
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

describeIfDb("cross-tenant isolation (Postgres + RLS)", () => {
  let orgA: Actor;
  let orgB: Actor;
  let leadIdA: string;
  let templateIdA: string;
  let searchIdA: string;
  let feedbackObjectPathA: string | undefined;

  beforeAll(async () => {
    orgA = await createActor("a");
    orgB = await createActor("b");

    // Dados na organização A, criados pelo próprio usuário A (não por
    // service_role) — assim o teste também prova que a escrita legítima passa.
    const { data: lead, error: leadError } = await orgA.client
      .from("leads")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        company_name: `Alvo Confidencial A ${RUN}`,
        city: "Belo Horizonte",
      })
      .select("id")
      .single();
    if (leadError) throw new Error(`insert lead A: ${leadError.message}`);
    leadIdA = lead.id;

    const { data: template, error: templateError } = await orgA.client
      .from("message_templates")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        name: `Template A ${RUN}`,
        content: "Olá {{empresa}}",
      })
      .select("id")
      .single();
    if (templateError) throw new Error(`insert template A: ${templateError.message}`);
    templateIdA = template.id;

    const { data: search, error: searchError } = await orgA.client
      .from("searches")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        query: `busca-confidencial-${RUN}`,
        location_label: "Belo Horizonte, MG",
        center: "SRID=4326;POINT(-43.9386 -19.9208)",
        radius_meters: 5000,
      })
      .select("id")
      .single();
    if (searchError) throw new Error(`insert search A: ${searchError.message}`);
    searchIdA = search.id;
  });

  afterAll(async () => {
    // Limpeza via service_role. organizations.owner_user_id referencia
    // auth.users SEM on delete cascade — apagar a org ANTES do usuário
    // (senão o deleteUser falha e os fixtures acumulam, degradando o
    // PostgREST local — P1-f do gate).
    if (feedbackObjectPathA) {
      await admin.storage.from("feedback-attachments").remove([feedbackObjectPathA]);
    }
    for (const actor of [orgA, orgB]) {
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

  // ── Leitura ────────────────────────────────────────────────────────────

  test("ISO-001: usuário de B não lê lead de A (listagem)", async () => {
    const { data, error } = await orgB.client.from("leads").select("id, company_name");
    expect(error).toBeNull();
    expect(data?.some((l) => l.id === leadIdA)).toBe(false);
  });

  test("ISO-002: usuário de B não lê lead de A por UUID conhecido", async () => {
    // O cenário que mais importa: o atacante JÁ tem o UUID.
    const { data, error } = await orgB.client.from("leads").select("*").eq("id", leadIdA);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("ISO-003: usuário de B não lê a organização de A", async () => {
    const { data } = await orgB.client
      .from("organizations")
      .select("id")
      .eq("id", orgA.organizationId);
    expect(data).toEqual([]);
  });

  test("ISO-004: usuário de B não lê memberships de A", async () => {
    const { data } = await orgB.client
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgA.organizationId);
    expect(data).toEqual([]);
  });

  test("ISO-005: usuário de B não lê busca de A", async () => {
    const { data } = await orgB.client.from("searches").select("id").eq("id", searchIdA);
    expect(data).toEqual([]);
  });

  test("ISO-006: usuário de B não lê template de A", async () => {
    const { data } = await orgB.client.from("message_templates").select("id").eq("id", templateIdA);
    expect(data).toEqual([]);
  });

  test("ISO-007: usuário de B não lê perfil de A", async () => {
    const { data } = await orgB.client.from("profiles").select("id").eq("id", orgA.userId);
    expect(data).toEqual([]);
  });

  // ── Escrita ────────────────────────────────────────────────────────────

  test("ISO-008: usuário de B não atualiza lead de A", async () => {
    const { error } = await orgB.client
      .from("leads")
      .update({ company_name: "INVADIDO" })
      .eq("id", leadIdA);

    // RLS em UPDATE não é erro: a linha simplesmente não é visível, então
    // 0 linhas afetadas. O que importa é o valor no banco NÃO ter mudado.
    expect(error).toBeNull();

    const { data: check } = await admin
      .from("leads")
      .select("company_name")
      .eq("id", leadIdA)
      .single();
    expect(check?.company_name).toBe(`Alvo Confidencial A ${RUN}`);
  });

  test("ISO-009: usuário de B não apaga lead de A", async () => {
    await orgB.client.from("leads").delete().eq("id", leadIdA);

    const { data: check } = await admin.from("leads").select("id").eq("id", leadIdA);
    expect(check?.length).toBe(1);
  });

  test("ISO-010: usuário de B não apaga busca de A", async () => {
    await orgB.client.from("searches").delete().eq("id", searchIdA);

    const { data: check } = await admin.from("searches").select("id").eq("id", searchIdA);
    expect(check?.length).toBe(1);
  });

  test("ISO-011: usuário de B não insere lead dentro da organização de A", async () => {
    const { error } = await orgB.client.from("leads").insert({
      organization_id: orgA.organizationId,
      created_by: orgB.userId,
      company_name: `Injetado por B ${RUN}`,
    });

    // Aqui a policy DEVE barrar com erro: o WITH CHECK falha na inserção.
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // insufficient_privilege / RLS violation

    const { data: check } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", orgA.organizationId)
      .eq("company_name", `Injetado por B ${RUN}`);
    expect(check).toEqual([]);
  });

  test("ISO-012: usuário de B não se auto-adiciona como membro da organização de A", async () => {
    const { error } = await orgB.client.from("organization_members").insert({
      organization_id: orgA.organizationId,
      user_id: orgB.userId,
      role: "owner",
    });
    expect(error).not.toBeNull();

    const { data: check } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgA.organizationId)
      .eq("user_id", orgB.userId);
    expect(check).toEqual([]);
  });

  test("ISO-013: usuário de B não suspende a organização de A", async () => {
    await orgB.client
      .from("organizations")
      .update({ status: "suspended" })
      .eq("id", orgA.organizationId);

    const { data: check } = await admin
      .from("organizations")
      .select("status")
      .eq("id", orgA.organizationId)
      .single();
    expect(check?.status).toBe("active");
  });

  // ── Contato confirmado + cadência ─────────────────────────────────────

  test("ISO-030: membro registra contato e inicia cadência atomicamente", async () => {
    const occurredAt = new Date().toISOString();
    const { data: activity, error } = await orgA.client.rpc("record_lead_contact", {
      p_lead_id: leadIdA,
      p_channel: "whatsapp",
      p_title: "Primeiro contato confirmado",
      p_outcome: "sent",
      p_occurred_at: occurredAt,
    });

    expect(error).toBeNull();
    expect(activity?.lead_id).toBe(leadIdA);
    expect(activity?.created_by).toBe(orgA.userId);
    expect(activity?.outcome).toBe("sent");

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("stage, last_interaction_at, cadence_started_at, cadence_step, cadence_completed_at")
      .eq("id", leadIdA)
      .single();
    expect(leadError).toBeNull();
    expect(lead?.stage).toBe("contacted");
    expect(new Date(lead!.last_interaction_at).toISOString()).toBe(occurredAt);
    expect(new Date(lead!.cadence_started_at).toISOString()).toBe(occurredAt);
    expect(lead?.cadence_step).toBe(0);
    expect(lead?.cadence_completed_at).toBeNull();
  });

  test("ISO-031: usuário de B não registra contato no lead de A por RPC", async () => {
    const { count: before } = await admin
      .from("lead_activities")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadIdA);

    const { error } = await orgB.client.rpc("record_lead_contact", {
      p_lead_id: leadIdA,
      p_channel: "whatsapp",
      p_title: "Contato forjado por B",
      p_outcome: "sent",
      p_occurred_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();

    const { count: after } = await admin
      .from("lead_activities")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadIdA);
    expect(after).toBe(before);
  });

  test("ISO-032: resposta confirmada encerra a cadência e registra outcome", async () => {
    const occurredAt = new Date(Date.now() + 60_000).toISOString();
    const { error } = await orgA.client.rpc("record_lead_contact", {
      p_lead_id: leadIdA,
      p_channel: "whatsapp",
      p_title: "Resposta recebida",
      p_outcome: "answered",
      p_occurred_at: occurredAt,
    });
    expect(error).toBeNull();

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("last_outcome, responded_at, cadence_started_at, cadence_completed_at")
      .eq("id", leadIdA)
      .single();
    expect(leadError).toBeNull();
    expect(lead?.last_outcome).toBe("answered");
    expect(new Date(lead!.responded_at).toISOString()).toBe(occurredAt);
    expect(new Date(lead!.cadence_completed_at).toISOString()).toBe(occurredAt);
    expect(new Date(lead!.cadence_started_at).toISOString()).not.toBe(occurredAt);
  });

  // ── Anexos privados de feedback ────────────────────────────────────────

  test("ISO-033: membro envia e remove screenshot na própria organização", async () => {
    feedbackObjectPathA = `${orgA.organizationId}/${orgA.userId}/${RUN}.png`;
    const { error } = await orgA.client.storage
      .from("feedback-attachments")
      .upload(feedbackObjectPathA, new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
        upsert: false,
      });
    expect(error).toBeNull();

    const { data: downloaded, error: downloadError } = await admin.storage
      .from("feedback-attachments")
      .download(feedbackObjectPathA);
    expect(downloadError).toBeNull();
    expect(downloaded?.size).toBe(4);

    const { error: crossTenantDownloadError } = await orgB.client.storage
      .from("feedback-attachments")
      .download(feedbackObjectPathA);
    expect(crossTenantDownloadError).not.toBeNull();

    const { error: removeError } = await orgA.client.storage
      .from("feedback-attachments")
      .remove([feedbackObjectPathA]);
    expect(removeError).toBeNull();

    const { data: remainingObjects, error: listError } = await admin.storage
      .from("feedback-attachments")
      .list(`${orgA.organizationId}/${orgA.userId}`, { search: `${RUN}.png` });
    expect(listError).toBeNull();
    expect(remainingObjects).toEqual([]);
    feedbackObjectPathA = undefined;
  });

  test("ISO-034: usuário de B não envia screenshot para a organização de A", async () => {
    const path = `${orgA.organizationId}/${orgB.userId}/${RUN}-forged.png`;
    const { error } = await orgB.client.storage
      .from("feedback-attachments")
      .upload(path, new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
        upsert: false,
      });
    expect(error).not.toBeNull();
  });

  test("ISO-035: usuário anônimo não envia screenshot de feedback", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const path = `${orgA.organizationId}/anonymous/${RUN}.png`;
    const { error } = await anon.storage
      .from("feedback-attachments")
      .upload(path, new Uint8Array([137, 80, 78, 71]), {
        contentType: "image/png",
        upsert: false,
      });
    expect(error).not.toBeNull();
  });

  // ── Exportação e consumo ───────────────────────────────────────────────

  test("ISO-014: usuário de B não lê exportações de A", async () => {
    const { data } = await orgB.client
      .from("exports")
      .select("id")
      .eq("organization_id", orgA.organizationId);
    expect(data).toEqual([]);
  });

  test("ISO-015: usuário de B não lê usage_events de A", async () => {
    const { data } = await orgB.client
      .from("usage_events")
      .select("id")
      .eq("organization_id", orgA.organizationId);
    expect(data).toEqual([]);
  });

  test("ISO-016: usuário de B não lê audit_logs de A", async () => {
    const { data } = await orgB.client
      .from("audit_logs")
      .select("id")
      .eq("organization_id", orgA.organizationId);
    expect(data).toEqual([]);
  });

  // ── Superfície de custo protegida (policy usage_events_product_insert) ──

  test("ISO-017: cliente não forja evento de CUSTO na própria organização", async () => {
    // A policy de INSERT só aceita evento de produto. Um cliente que tente
    // gravar consumo de provider (que alimenta quota e custo) deve ser barrado.
    const { error } = await orgB.client.from("usage_events").insert({
      organization_id: orgB.organizationId,
      user_id: orgB.userId,
      event_type: "place_details_request",
      quantity: 5000,
      estimated_cost: 999,
    });
    expect(error).not.toBeNull();
  });

  test("ISO-018: cliente grava evento de PRODUTO na própria organização", async () => {
    // Contraprova de ISO-017: a forma legítima (a que track() usa) passa.
    // Se este teste falhar, o analytics de produto voltou a não persistir.
    const { error } = await orgB.client.from("usage_events").insert({
      organization_id: orgB.organizationId,
      user_id: orgB.userId,
      metric: "first_search_started",
      quantity: 1,
      source_type: "product_event",
    });
    expect(error).toBeNull();
  });

  test("ISO-019: cliente não grava evento de produto na organização de A", async () => {
    const { error } = await orgB.client.from("usage_events").insert({
      organization_id: orgA.organizationId,
      user_id: orgB.userId,
      metric: "first_search_started",
      quantity: 1,
      source_type: "product_event",
    });
    expect(error).not.toBeNull();
  });

  test("ISO-020: cliente não atribui evento de produto a outro usuário", async () => {
    const { error } = await orgB.client.from("usage_events").insert({
      organization_id: orgB.organizationId,
      user_id: orgA.userId, // user_id != auth.uid()
      metric: "first_search_started",
      quantity: 1,
      source_type: "product_event",
    });
    expect(error).not.toBeNull();
  });

  // ── Contador de rate limit é invisível ao cliente ──────────────────────

  test("ISO-021: cliente não lê nem escreve rate_limit_events", async () => {
    const { data, error: selectError } = await orgB.client
      .from("rate_limit_events")
      .select("id")
      .limit(1);
    // RLS habilitada sem policy + grants revogados: nada de linhas.
    expect(selectError !== null || (data ?? []).length === 0).toBe(true);

    const { error: insertError } = await orgB.client
      .from("rate_limit_events")
      .insert({ scope_key: `user:${orgB.userId}`, operation: "accept-invitation" });
    expect(insertError).not.toBeNull();
  });

  // ── Sem sessão ─────────────────────────────────────────────────────────

  test("ISO-022: usuário anônimo não lê lead nenhum", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anon.from("leads").select("id").eq("id", leadIdA);
    expect(data ?? []).toEqual([]);
  });

  test("ISO-023: usuário sem membership não é admin de plataforma", async () => {
    const { data } = await orgB.client.rpc("is_platform_admin");
    expect(data).toBe(false);
  });

  // ── Error events (error tracking do beta) ─────────────────────────────

  test("ISO-024: cliente autenticado grava error_event na própria organização", async () => {
    const { error } = await orgB.client.from("error_events").insert({
      source: "browser",
      location: "ISO-024",
      message: "Erro de teste — pode ignorar",
      severity: "error",
      organization_id: orgB.organizationId,
      environment: "development",
      user_agent: "bun-test",
    });
    expect(error).toBeNull();
  });

  test("ISO-025: cliente autenticado grava error_event SEM organização (pré-org)", async () => {
    // Erros que acontecem antes da organização ser resolvida (ex: signup quebrado)
    // devem ser aceitos com organization_id = null.
    const { error } = await orgB.client.from("error_events").insert({
      source: "browser",
      location: "ISO-025",
      message: "Erro pré-organização — pode ignorar",
      severity: "error",
      organization_id: null,
      environment: "development",
      user_agent: "bun-test",
    });
    expect(error).toBeNull();
  });

  test("ISO-026: cliente NÃO grava error_event na organização de A", async () => {
    const { error } = await orgB.client.from("error_events").insert({
      source: "browser",
      location: "ISO-026",
      message: "Tentativa de poluir org A",
      severity: "error",
      organization_id: orgA.organizationId,
      environment: "development",
      user_agent: "bun-test",
    });
    expect(error).not.toBeNull();
  });

  test("ISO-027: cliente NÃO lê error_events (nem os próprios)", async () => {
    // Erros podem conter detalhes internos — cliente nunca deve ler.
    // Primeiro gravamos um erro legítimo via service_role para ter algo para ler.
    const { error: insertError } = await admin.from("error_events").insert({
      source: "edge-function",
      location: "ISO-027-setup",
      message: "Erro de setup — pode ignorar",
      severity: "error",
      organization_id: orgB.organizationId,
      environment: "development",
    });
    expect(insertError).toBeNull();

    // Agora o cliente tenta ler.
    const { data, error: selectError } = await orgB.client
      .from("error_events")
      .select("id")
      .limit(1);
    // RLS: authenticated tem grant de SELECT revogado.
    expect(selectError !== null || (data ?? []).length === 0).toBe(true);
  });

  test("ISO-028: usuário anônimo NÃO grava error_event", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await anon.from("error_events").insert({
      source: "browser",
      location: "ISO-028",
      message: "Anônimo não deve gravar",
      severity: "error",
      environment: "development",
      user_agent: "bun-test",
    });
    expect(error).not.toBeNull();
  });

  test("ISO-029: service_role lê error_events normalmente", async () => {
    const { data, error } = await admin.from("error_events").select("id").limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
