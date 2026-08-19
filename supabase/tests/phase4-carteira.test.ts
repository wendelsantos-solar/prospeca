// Testes REAIS da carteira comercial (Fase 4) — Postgres local + edge
// functions servidas (import map corrigido). Migration 20260815000013.
//
// Cenários (handoff-spec 4.TESTES.B):
//   * carteira com MAIS de 50 leads é paginável (fixture com 60+);
//   * totais por estágio vêm do SERVIDOR e casam com o real;
//   * métricas do painel sobre >50 leads não subestimam;
//   * atribuir lead a membro da MESMA org funciona; a usuário de OUTRA org NÃO;
//   * export do pipeline respeita organização (B não exporta leads de A);
//   * export grava auditoria em `exports`.
//
// AUTO-SKIP: convenção do repo. Fixtures com sufixo único e limpeza FK-safe
// (organizations ANTES de auth.users).

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
    `[phase4-carteira] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(`[phase4-carteira] Supabase local não acessível em ${API_URL} — suíte PULADA.`);
}

const RUN = Math.random().toString(36).slice(2, 10);

interface Actor {
  userId: string;
  email: string;
  organizationId: string;
  client: SupabaseClient;
  accessToken: string;
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function createActor(label: string): Promise<Actor> {
  const email = `f4-${label}-${RUN}@example.com`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `F4 ${label}`, company_name: `F4 ${label} ${RUN}` },
  });
  if (createError) throw new Error(`createUser(${label}): ${createError.message}`);
  const userId = created.user!.id;

  const { data: memberships, error: memberError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  if (memberError) throw new Error(`memberships(${label}): ${memberError.message}`);
  const organizationId = memberships?.[0]?.organization_id as string;
  if (!organizationId) throw new Error(`handle_new_user() não criou organização para ${label}`);

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signed, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);
  client.auth.setSession({
    access_token: signed.session!.access_token,
    refresh_token: signed.session!.refresh_token,
  });

  return {
    userId,
    email,
    organizationId,
    client,
    accessToken: signed.session!.access_token,
  };
}

describeIfDb("carteira comercial (Fase 4): paginação, métricas, responsável, export", () => {
  let orgA: Actor;
  let orgB: Actor;
  let orgC: Actor;
  let leadIdA: string;
  let markerNameA: string;

  const STAGES = ["new", "qualified", "contacted", "won", "discarded"];

  beforeAll(async () => {
    orgA = await createActor("a");
    orgB = await createActor("b");
    orgC = await createActor("c"); // será adicionado à org A como membro

    // Carteira com 63 leads na org A — MAIS do que o teto antigo de 50.
    const rows = Array.from({ length: 63 }, (_, i) => ({
      organization_id: orgA.organizationId,
      created_by: orgA.userId,
      company_name: i === 0 ? `Marcador Confidencial A ${RUN}` : `Lead A ${RUN} ${i}`,
      city: i % 2 === 0 ? "Belo Horizonte" : "Contagem",
      stage: STAGES[i % STAGES.length],
      temperature: (["hot", "warm", "cold"] as const)[i % 3],
      score: 10 + (i % 90),
      has_website: i % 3 === 0,
      email: i % 4 === 0 ? `contato${i}-${RUN}@example.com` : null,
      estimated_value: 1000 + i * 100,
      closed_value: STAGES[i % STAGES.length] === "won" ? 5000 + i : null,
    }));
    const { error: bulkError } = await admin.from("leads").insert(rows);
    if (bulkError) throw new Error(`insert 63 leads: ${bulkError.message}`);

    markerNameA = `Marcador Confidencial A ${RUN}`;
    const { data: marker } = await admin
      .from("leads")
      .select("id")
      .eq("company_name", markerNameA)
      .single();
    leadIdA = marker.id as string;

    // C adicionado à org A (membro legítimo para atribuição).
    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: orgA.organizationId,
      user_id: orgC.userId,
      role: "member",
    });
    if (memberError) throw new Error(`membership C->A: ${memberError.message}`);

    // Leads de B (para provar o escopo do export).
    const { error: bError } = await admin.from("leads").insert({
      organization_id: orgB.organizationId,
      created_by: orgB.userId,
      company_name: `Lead B ${RUN}`,
      stage: "new",
    });
    if (bError) throw new Error(`insert lead B: ${bError.message}`);
  });

  afterAll(async () => {
    // FK-safe: organizations ANTES de auth.users.
    for (const actor of [orgA, orgB, orgC]) {
      if (!actor) continue;
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

  // ── 4.1: paginação real ──────────────────────────────────────────────────

  test("CART-001: page 1 traz 50 com hasMore; page 2 traz o restante; total = 63", async () => {
    const page1 = await orgA.client
      .from("leads")
      .select("id", { count: "exact" })
      .eq("organization_id", orgA.organizationId)
      .range(0, 49);
    expect(page1.error).toBeNull();
    expect(page1.data?.length).toBe(50);
    expect(page1.count).toBe(63);

    const page2 = await orgA.client
      .from("leads")
      .select("id", { count: "exact" })
      .eq("organization_id", orgA.organizationId)
      .range(50, 99);
    expect(page2.error).toBeNull();
    expect(page2.data?.length).toBe(13);
    expect(page2.count).toBe(63);
  });

  test("CART-002: totais por estágio vêm do SERVIDOR e casam com o real", async () => {
    const { data, error } = await orgA.client.rpc("get_lead_stage_counts", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const counts = data as { total: number; byStage: Record<string, number> };
    expect(counts.total).toBe(63);

    const real: Record<string, number> = {};
    for (let i = 0; i < 63; i++) {
      const stage = STAGES[i % STAGES.length];
      real[stage] = (real[stage] ?? 0) + 1;
    }
    expect(counts.byStage).toEqual(real);
  });

  test("CART-003: usuário de OUTRA org recebe FORBIDDEN no stage counts", async () => {
    const { error } = await orgB.client.rpc("get_lead_stage_counts", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).not.toBeNull();
  });

  // ── 4.2: painel sobre a carteira inteira ─────────────────────────────────

  test("CART-004: overview não subestima com >50 leads (totalLeads = 63)", async () => {
    const start = new Date(Date.now() - 30 * 86400_000).toISOString();
    const end = new Date(Date.now() + 86400_000).toISOString();
    const { data, error } = await orgA.client.rpc("get_dashboard_overview", {
      p_organization_id: orgA.organizationId,
      p_start_date: start,
      p_end_date: end,
    });
    expect(error).toBeNull();
    const o = data as Record<string, unknown>;
    expect(o.totalLeads).toBe(63);
    expect(o.allTime).toBeDefined();
    const allTime = o.allTime as Record<string, unknown>;
    expect(allTime.totalFound).toBe(63);
    expect((o.byStage as Record<string, number>).new).toBe(13); // 63/5 → índices 0,5,...: 13
    expect(Array.isArray(o.dailySeries)).toBe(true);
  });

  // ── 4.3: responsável ─────────────────────────────────────────────────────

  test("CART-005: membro da MESMA org pode ser atribuído", async () => {
    const { error } = await orgA.client.rpc("assign_lead", {
      p_lead_id: leadIdA,
      p_assigned_to: orgC.userId,
    });
    expect(error).toBeNull();

    const { data, error: readError } = await admin
      .from("leads")
      .select("assigned_to")
      .eq("id", leadIdA)
      .single();
    expect(readError).toBeNull();
    expect(data?.assigned_to).toBe(orgC.userId);
  });

  test("CART-006: atribuir a usuário de OUTRA org falha (42501)", async () => {
    const { error } = await orgA.client.rpc("assign_lead", {
      p_lead_id: leadIdA,
      p_assigned_to: orgB.userId,
    });
    expect(error).not.toBeNull();
    expect(error?.code ?? error?.message).toMatch(/42501|ASSIGNEE_NOT_MEMBER|FORBIDDEN/);
  });

  test("CART-007: usuário de OUTRA org não atribui lead da org A", async () => {
    const { error } = await orgB.client.rpc("assign_lead", {
      p_lead_id: leadIdA,
      p_assigned_to: orgB.userId,
    });
    expect(error).not.toBeNull();
  });

  test("CART-008: list_organization_members expõe apenas membros da própria org", async () => {
    const { data, error } = await orgA.client.rpc("list_organization_members", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((m: { user_id: string }) => m.user_id);
    expect(ids).toContain(orgA.userId);
    expect(ids).toContain(orgC.userId);
    expect(ids).not.toContain(orgB.userId);
  });

  // ── 4.4: export do pipeline ──────────────────────────────────────────────

  async function exportAs(actor: Actor, format: "csv" | "xlsx") {
    // P1-f: o PostgREST LOCAL (pool de 10 conexões) devolve 5xx transitório na
    // PRIMEIRA chamada de um worker fresco do edge runtime ("Falha ao verificar
    // plano." = connection reset na RPC de entitlements — o produto falha
    // FECHADO, nunca retorna 200 com dado errado). Retry apenas de 5xx
    // transitório; 4xx (entitlement/rate limit) NUNCA é mascarado.
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      lastRes = await fetch(`${API_URL}/functions/v1/create-export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actor.accessToken}`,
        },
        body: JSON.stringify({
          format,
          fields: ["company_name", "city", "stage", "email"],
          filters: {},
        }),
      });
      if (lastRes.status < 500) return lastRes;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
    return lastRes!;
  }

  test("CART-009: export CSV de A contém leads de A (e não vaza B)", async () => {
    const res = await exportAs(orgA, "csv");
    expect(res.status).toBe(200);
    // P1-c (Fase 4c): octet-stream para o SDK entregar Blob; nome no header.
    expect(res.headers.get("content-type")).toContain("application/octet-stream");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain("leads-");
    expect(disposition).toContain(".csv");
    const text = await res.text();
    expect(text).toContain(markerNameA);
    expect(text).not.toContain(`Lead B ${RUN}`);

    // O CONTRATO DO SDK: functions.invoke devolve Blob (não string) para CSV.
    const { data, error: sdkError } = await orgA.client.functions.invoke("create-export", {
      body: { format: "csv", fields: ["company_name"], filters: {} },
    });
    expect(sdkError).toBeNull();
    expect(data instanceof Blob).toBe(true);
    expect(await (data as Blob).text()).toContain(markerNameA);

    // Auditoria: linha em exports para a org A.
    const { data: exports } = await admin
      .from("exports")
      .select("id, format, row_count")
      .eq("organization_id", orgA.organizationId)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(exports?.length).toBe(1);
    expect(exports![0].format).toBe("csv");
    expect(exports![0].row_count).toBe(63);
  });

  test("CART-010: export de B NÃO contém leads de A (escopo por organização)", async () => {
    const res = await exportAs(orgB, "csv");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(markerNameA);
    expect(text).toContain(`Lead B ${RUN}`);
  });

  test("CART-011: xlsx no plano free é rejeitado (entitlement)", async () => {
    const res = await exportAs(orgA, "xlsx");
    // free tem csv_export mas NÃO xlsx_export — o servidor recusa.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("CART-014: download XLSX real funciona (plano com xlsx_export)", async () => {
    // O catálogo do PILOTO desativa xlsx_export em todos os planos
    // (20260801000002 — 'disable entitlements that are not enforced
    // end-to-end yet'), então o gate rejeita corretamente. Para provar o
    // download XLSX de ponta, a fixture cria um PLANO DE TESTE exclusivo com
    // xlsx_export=true e assina a org A nele — cleanup remove o plano.
    const { data: fixturePlan, error: planError } = await admin
      .from("billing_plans")
      .insert({
        code: `f4c-test-xlsx-${RUN}`,
        name: `F4c test xlsx ${RUN}`,
        is_public: false,
        features: { csv_export: true, xlsx_export: true },
        limits: {},
      })
      .select("id")
      .single();
    expect(planError).toBeNull();
    const { error: subError } = await admin
      .from("subscriptions")
      .update({ plan_id: fixturePlan.id })
      .eq("organization_id", orgA.organizationId);
    expect(subError).toBeNull();

    const res = await exportAs(orgA, "xlsx");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/octet-stream");
    expect(res.headers.get("content-disposition") ?? "").toContain(".xlsx");
    const buf = new Uint8Array(await res.arrayBuffer());
    // Assinatura ZIP (XLSX é um zip): PK\x03\x04.
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(100);

    // Contrato do SDK para XLSX: Blob também.
    const { data, error: sdkError } = await orgA.client.functions.invoke("create-export", {
      body: { format: "xlsx", fields: ["company_name"], filters: {} },
    });
    expect(sdkError).toBeNull();
    expect(data instanceof Blob).toBe(true);
    expect((data as Blob).size).toBeGreaterThan(100);

    // Limpeza do plano de fixture (a subscription cascateia com a org no afterAll).
    await admin.from("billing_plans").delete().eq("id", fixturePlan.id);
  });

  // ── 4.1b: contagens de hoje/atrasadas do servidor ───────────────────────

  test("CART-012: get_today_counts conta atividades vencidas/do dia do SERVIDOR", async () => {
    // Fixture: uma atividade vencida e uma de hoje no mesmo lead.
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", orgA.organizationId)
      .eq("company_name", markerNameA)
      .single();
    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    const today = new Date().toISOString();
    const { error: actError } = await admin.from("lead_activities").insert([
      {
        lead_id: lead.id,
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        type: "follow_up",
        title: "Follow-up vencido",
        status: "pending",
        scheduled_at: yesterday,
      },
      {
        lead_id: lead.id,
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        type: "follow_up",
        title: "Follow-up hoje",
        status: "pending",
        scheduled_at: today,
      },
    ]);
    expect(actError).toBeNull();

    const { data, error } = await orgA.client.rpc("get_today_counts", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const counts = data as { today: number; overdue: number; firstReach: number };
    expect(counts.overdue).toBeGreaterThanOrEqual(1);
    expect(counts.today).toBeGreaterThanOrEqual(1);
    expect(typeof counts.firstReach).toBe("number");
  });

  test("CART-013: contagens do servidor refletem move de estágio (P2-c)", async () => {
    // Move real (mesmo RPC que o dnd dispara) e confere as contagens.
    const { error: moveError } = await orgA.client.rpc("move_lead_stage", {
      p_lead_id: leadIdA,
      p_to_stage: "qualified",
      p_metadata: {},
    });
    expect(moveError).toBeNull();

    const { data, error } = await orgA.client.rpc("get_lead_stage_counts", {
      p_organization_id: orgA.organizationId,
    });
    expect(error).toBeNull();
    const counts = data as { total: number; byStage: Record<string, number> };
    expect(counts.total).toBe(63);
    // marker era 'new' (índice 0 da fixture) → agora qualified.
    expect(counts.byStage.qualified).toBe(14);
  });

  test("CART-016: resolve_lead_batch resolve no servidor e NÃO vaza outra org", async () => {
    // P2 da 4d: seleção em lote além das páginas em cache.
    const { data: bLead } = await admin
      .from("leads")
      .select("id")
      .eq("organization_id", orgB.organizationId)
      .limit(1)
      .single();

    const { data: resolved, error } = await orgA.client.rpc("resolve_lead_batch", {
      p_organization_id: orgA.organizationId,
      p_ids: [leadIdA, bLead.id],
    });
    expect(error).toBeNull();
    const rows = (resolved ?? []) as Array<{ id: string }>;
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(leadIdA);
    // O id da org B é filtrado pelo escopo da org do chamador.
    expect(ids).not.toContain(bLead.id);
  });

  test("CART-017: resolve_lead_batch de OUTRA org é FORBIDDEN", async () => {
    const { error } = await orgB.client.rpc("resolve_lead_batch", {
      p_organization_id: orgA.organizationId,
      p_ids: [leadIdA],
    });
    expect(error).not.toBeNull();
  });

  test("CART-015: addToFunnel real reflete na lista que o Kanban lê", async () => {
    // Caminho REAL do addToFunnel (import-search-results) e a MESMA query que
    // o repositório faz para a lista do Kanban.
    const { data: search, error: searchError } = await orgA.client
      .from("searches")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        query: `busca-addtofunnel-${RUN}`,
        location_label: "Belo Horizonte, MG",
        center: "SRID=4326;POINT(-43.9386 -19.9208)",
        radius_meters: 5000,
      })
      .select("id")
      .single();
    expect(searchError).toBeNull();

    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        organization_id: orgA.organizationId,
        provider: "google_places",
        provider_place_id: `plc-f4c-${RUN}`,
        name: `Novo Lead F4c ${RUN}`,
        location: "SRID=4326;POINT(-43.9386 -19.9208)",
      })
      .select("id")
      .single();
    expect(placeError).toBeNull();

    const { error: resultError } = await admin.from("search_results").insert({
      search_id: search.id,
      place_id: place.id,
      distance_meters: 10,
      is_inside_radius: true,
      score: 80,
      temperature: "hot",
    });
    expect(resultError).toBeNull();

    const { error: importError } = await orgA.client.functions.invoke("import-search-results", {
      body: { searchId: search.id, placeIds: [place.id], stage: "new" },
    });
    expect(importError).toBeNull();

    // A lista do Kanban (mesma query do repositório) agora contém o lead novo.
    const { data: list, error: listError } = await orgA.client
      .from("leads")
      .select("id", { count: "exact" })
      .eq("organization_id", orgA.organizationId)
      .eq("company_name", `Novo Lead F4c ${RUN}`);
    expect(listError).toBeNull();
    expect(list?.length).toBe(1);
  });
});
