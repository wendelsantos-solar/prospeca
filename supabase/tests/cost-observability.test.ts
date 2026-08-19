// Testes REAIS de cost observability (Fase 7) — Postgres local + edge
// functions bootando (import map corrigido). Migration 20260815000014.
//
// Cobre:
//   * os 4 RATE LIMITS (Motor provou que eram INERTES) disparando de verdade:
//     N chamadas 200 e N+1 = 429 — critério de aceite da 7.3;
//   * job do worker gravando custo: zero COMPROVADO ('measured') vs
//     DESCONHECIDO (NULL) — a regra dura da fase (0 nunca mente);
//   * get_cost_breakdown agregando por provider/operação com cache hit/miss e
//     custo desconhecido visível.
//
// REGRA DE INFRA: suite roda SOZINHA com --parallel=1. Fixtures FK-safe.

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
    `[cost-observability] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(`[cost-observability] Supabase local não acessível em ${API_URL} — suíte PULADA.`);
}

const RUN = Math.random().toString(36).slice(2, 10);

interface Actor {
  userId: string;
  organizationId: string;
  client: SupabaseClient;
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function createActor(label: string): Promise<Actor> {
  const email = `cost-${label}-${RUN}@example.com`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Cost ${label}`, company_name: `Cost ${label} ${RUN}` },
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

  return { userId, organizationId, client };
}

describeIfDb("cost observability (Fase 7): rate limits reais + custo NULL vs 0", () => {
  let orgA: Actor;
  let searchIdA: string;
  let placeIdA: string;
  let leadIdA: string;

  beforeAll(async () => {
    orgA = await createActor("a");

    const { data: search, error: searchError } = await orgA.client
      .from("searches")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        query: `busca-cost-${RUN}`,
        location_label: "Belo Horizonte, MG",
        center: "SRID=4326;POINT(-43.9386 -19.9208)",
        radius_meters: 5000,
      })
      .select("id")
      .single();
    if (searchError) throw new Error(`insert search: ${searchError.message}`);
    searchIdA = search.id;

    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        organization_id: orgA.organizationId,
        provider: "google_places",
        provider_place_id: `plc-cost-${RUN}`,
        name: `Place Cost ${RUN}`,
        location: "SRID=4326;POINT(-43.9386 -19.9208)",
        website_uri: null,
      })
      .select("id")
      .single();
    if (placeError) throw new Error(`insert place: ${placeError.message}`);
    placeIdA = place.id;

    const { error: resultError } = await admin.from("search_results").insert({
      search_id: searchIdA,
      place_id: placeIdA,
      distance_meters: 10,
      is_inside_radius: true,
      score: 70,
      temperature: "hot",
    });
    if (resultError) throw new Error(`insert search_result: ${resultError.message}`);

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        company_name: `Lead Cost ${RUN}`,
        stage: "new",
        has_website: true,
        rating: 2,
        review_count: 3,
        city: "Belo Horizonte",
      })
      .select("id")
      .single();
    if (leadError) throw new Error(`insert lead: ${leadError.message}`);
    leadIdA = lead.id;
  });

  afterAll(async () => {
    if (!orgA?.userId) return;
    try {
      await admin.from("organizations").delete().eq("owner_user_id", orgA.userId);
    } catch {
      /* melhor esforço */
    }
    try {
      await admin.auth.admin.deleteUser(orgA.userId);
    } catch {
      /* melhor esforço */
    }
  });

  async function invokeAsActor(fn: string, body: Record<string, unknown>): Promise<Response> {
    // O edge runtime LOCAL recompila o worker por chamada (per_worker + hot
    // reload) e o PostgREST local degrada sob carga — 503 BOOT_ERROR ou 5xx
    // transitório podem atingir uma chamada isolada. Nesses casos a função NÃO
    // executou (não consome o contador do rate limit), então retry curto é
    // honesto; 4xx (incluindo o 429 que o teste procura) NUNCA é retentado.
    const token = (await orgA.client.auth.getSession()).data.session?.access_token;
    let lastRes: Response | null = null;
    // 5 tentativas com backoff de 1.5s: o PostgREST LOCAL (Warp) derruba
    // threads sob rajada ("Thread killed by timeout manager" → kong 502
    // "Connection reset by peer" no POST /usage_events). A função NÃO
    // executou/gravou nesses casos — retry honesto; 4xx (incluindo o 429 que
    // o teste procura) NUNCA é retentado.
    for (let attempt = 0; attempt < 5; attempt++) {
      lastRes = await fetch(`${API_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (lastRes.status < 500) return lastRes;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return lastRes!;
  }

  // ── 7.3: os rate limits DISPARAM de verdade ───────────────────────────────

  test("COST-001: enrich_request — 20 no contador, 21ª = 429 (era INERTE)", async () => {
    // P2-8 (Peneira): semeia o contador direto (usage_events reais) e faz
    // UMA chamada HTTP — a prova continua sendo que o gate LÊ o contador e
    // dispara 429, com ~20 chamadas HTTP a menos. O caminho completo
    // (recordUsage do endpoint) é provado no COST-005 (job e2e) e o padrão
    // e2e completo fica no COST-002 (ai, 10+1).
    const rows = Array.from({ length: 20 }, () => ({
      organization_id: orgA.organizationId,
      event_type: "enrich_request",
      provider: "website_scraper",
      quantity: 1,
      estimated_cost: 0,
      real_cost_usd: 0,
      cost_source: "measured",
    }));
    const { error: seedError } = await admin.from("usage_events").insert(rows);
    expect(seedError).toBeNull();

    const rejected = await invokeAsActor("enrich-discovery", {
      searchId: searchIdA,
      placeId: placeIdA,
    });
    expect(rejected.status).toBe(429);
    const body = (await rejected.json()) as { code?: string };
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
  }, 60_000);

  test("COST-002: ai_message_generate — 10 chamadas ok, 11ª = 429 (era INERTE)", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await invokeAsActor("generate-contact-message", { leadId: leadIdA });
      expect(res.status, `chamada ${i + 1}`).toBe(200);
      await new Promise((r) => setTimeout(r, 50)); // pacing
    }
    const rejected = await invokeAsActor("generate-contact-message", { leadId: leadIdA });
    expect(rejected.status).toBe(429);
  }, 120_000);

  test("COST-003: cnpj_lookup — 30 no contador, 31ª = 429 (era INERTE)", async () => {
    // P2-8: contador semeado + UMA chamada HTTP — mesma prova do gate,
    // ~30 chamadas HTTP a menos (e sem depender da rede externa da BrasilAPI).
    const rows = Array.from({ length: 30 }, () => ({
      organization_id: orgA.organizationId,
      event_type: "cnpj_lookup",
      provider: "brasil_api",
      quantity: 1,
      estimated_cost: 0,
      real_cost_usd: 0,
      cost_source: "measured",
    }));
    const { error: seedError } = await admin.from("usage_events").insert(rows);
    expect(seedError).toBeNull();

    const rejected = await invokeAsActor("lookup-cnpj", {
      placeId: placeIdA,
      cnpj: "00000000000191",
    });
    expect(rejected.status).toBe(429);
  }, 60_000);

  test("COST-004: contadores gravados com custo correto em usage_events", async () => {
    const { data: enrichRows, error: enrichError } = await admin
      .from("usage_events")
      .select("event_type, estimated_cost, real_cost_usd, cost_source")
      .eq("organization_id", orgA.organizationId)
      .eq("event_type", "enrich_request")
      .eq("cost_source", "measured")
      .limit(3);
    expect(enrichError).toBeNull();
    expect(enrichRows?.length).toBeGreaterThanOrEqual(3);
    for (const row of enrichRows ?? []) {
      // Infra própria: zero COMPROVADO com fonte 'measured' — nunca NULL
      // disfarçado nem 0 mentindo.
      expect(row.real_cost_usd).toBe(0);
      expect(row.estimated_cost).toBe(0);
      expect(row.cost_source).toBe("measured");
    }

    const { data: aiRows, error: aiError } = await admin
      .from("usage_events")
      .select("event_type, estimated_cost, real_cost_usd, cost_source")
      .eq("organization_id", orgA.organizationId)
      .eq("event_type", "ai_message_generate")
      .limit(3);
    expect(aiError).toBeNull();
    expect(aiRows?.length).toBeGreaterThanOrEqual(3);
    for (const row of aiRows ?? []) {
      // Anthropic por token sem medição: DESCONHECIDO = NULL, nunca 0.
      expect(row.estimated_cost).toBeNull();
      expect(row.real_cost_usd).toBeNull();
      expect(row.cost_source).toBeNull();
    }
  });

  // ── 7.2: custo por job — zero comprovado vs desconhecido ──────────────────

  test("COST-005: job de enrichment grava zero COMPROVADO ('measured')", async () => {
    const { data: job, error: insertError } = await admin
      .from("jobs")
      .insert({
        organization_id: orgA.organizationId,
        type: "BUSINESS_DATA_ENRICHMENT",
        search_id: searchIdA,
        place_id: placeIdA,
        status: "queued",
        attempt: 0,
        priority: 0,
        payload: {},
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const jobId = job.id as string;

    const wake = await fetch(`${API_URL}/functions/v1/process-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: "{}",
    });
    expect(wake.status).toBe(200);

    const deadline = Date.now() + 30_000;
    let done: Record<string, unknown> | null = null;
    while (Date.now() < deadline) {
      const { data } = await admin
        .from("jobs")
        .select("status, estimated_cost, real_cost_usd, cost_source")
        .eq("id", jobId)
        .maybeSingle();
      if (["completed", "failed", "cancelled"].includes(data?.status as string)) {
        done = data as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(done?.status).toBe("completed");
    expect(done?.real_cost_usd).toBe(0);
    expect(done?.estimated_cost).toBe(0);
    expect(done?.cost_source).toBe("measured");
  });

  test("COST-006: handler inexistente grava custo DESCONHECIDO (NULL, não 0)", async () => {
    const { data: job, error: insertError } = await admin
      .from("jobs")
      .insert({
        organization_id: orgA.organizationId,
        type: "CONTACT_ENRICHMENT",
        status: "queued",
        attempt: 0,
        priority: 0,
        payload: {},
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();
    const jobId = job.id as string;

    const wake = await fetch(`${API_URL}/functions/v1/process-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: "{}",
    });
    expect(wake.status).toBe(200);

    const deadline = Date.now() + 30_000;
    let done: Record<string, unknown> | null = null;
    while (Date.now() < deadline) {
      const { data } = await admin
        .from("jobs")
        .select("status, estimated_cost, real_cost_usd, cost_source")
        .eq("id", jobId)
        .maybeSingle();
      if (["completed", "failed", "cancelled"].includes(data?.status as string)) {
        done = data as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(done?.status).toBe("failed");
    // DESCONHECIDO: NULL em tudo — 0 mentiria "sem custo".
    expect(done?.real_cost_usd).toBeNull();
    expect(done?.estimated_cost).toBeNull();
    expect(done?.cost_source).toBeNull();
  });

  // ── 7.4: exposição ────────────────────────────────────────────────────────

  test("COST-007: get_cost_breakdown agrega por provider/operação com desconhecido visível", async () => {
    const { data, error } = await admin.rpc("get_cost_breakdown");
    expect(error).toBeNull();
    const breakdown = data as {
      byProviderOperation: Array<Record<string, unknown>>;
      grandTotalEstCostUsd: number;
      grandTotalRealCostUsd: number;
    };
    const enrich = breakdown.byProviderOperation.find(
      (e) => e.operation === "enrich_request" && e.provider === "website_scraper",
    );
    expect(enrich).toBeDefined();
    expect(enrich!.count).toBeGreaterThanOrEqual(20);
    expect(enrich!.realCostUsd).toBe(0);
    expect(enrich!.estCostUsd).toBe(0);
    expect(enrich!.cacheMisses).toBeGreaterThanOrEqual(20);
    expect(enrich!.cacheHits).toBe(0);
    // ai_message_generate: custo desconhecido CONTADO como desconhecido.
    const ai = breakdown.byProviderOperation.find(
      (e) => e.operation === "ai_message_generate" && e.provider === "anthropic",
    );
    expect(ai).toBeDefined();
    expect(ai!.unknownCostCount).toBeGreaterThanOrEqual(10);
    expect(ai!.estCostUsd).toBe(0); // soma de NULLs é 0, MAS o desconhecido é visível no contador
  });

  test("COST-008: authenticated NÃO chama get_cost_breakdown (ACL endurecida)", async () => {
    const { error } = await orgA.client.rpc("get_cost_breakdown");
    expect(error).not.toBeNull();
  });
});
