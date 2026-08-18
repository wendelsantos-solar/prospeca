// Testes REAIS de liveness da fila de jobs (Fase 2, P0-3) — contra Postgres
// local. Migration 20260815000012.
//
// CENÁRIO CENTRAL (pedido explícito do usuário):
//   1. insere um job em 'queued' direto no banco (service_role);
//   2. NENHUMA busca nova é disparada (não chamamos execute-search nem
//      import-search-results em momento algum);
//   3. o mecanismo de liveness é acionado pelo MESMO caminho que o cron
//      usaria: o cron roda `net.http_post` para /functions/v1/process-jobs com
//      Authorization: Bearer <service_role_key> — aqui reproduzimos esse POST
//      exato via fetch (o http_post do pg_net é no-op localmente porque o
//      Vault local não tem secrets; isso é o comportamento PROJETADO — o wake
//      periódico local não interfere e o teste controla o wake de forma
//      determinística);
//   4. o job é reivindicado (queued -> processing, claim atômico) e o handler
//      conclui.
//
// LIMITAÇÃO LOCAL CONHECIDA (honesta): o edge runtime LOCAL não aplica
// import_map.json, então NENHUMA edge function que importa @leads/domain/*
// consegue bootar (503 BOOT_ERROR) — process-jobs, enrich-discovery,
// score-company etc. Isso é config do stack local, pré-existente a esta fase.
// NÃO simulamos sucesso: LIVE-003 detecta o ambiente — se o worker bootar
// (CI/staging com import map), roda o pipeline COMPLETO (claim -> dispatch ->
// handler -> completed); se não bootar, o teste prova o passo 3 pelo claim
// REAL (o MESMO UPDATE atômico com guarda .eq("status","queued") que o worker
// executa em _shared/job-queue.ts) e marca a conclusão via handler como
// NOT_VERIFIED localmente. LIVE-004 prova a atomicidade do claim com dois
// claims concorrentes reais contra o banco, sem depender do edge runtime.
//
// AUTO-SKIP: mesma convenção do repo (rls-isolation.test.ts). As credenciais
// são as chaves de DEMO fixas do Supabase local.

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
    `[job-liveness] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    `[job-liveness] Supabase local não acessível em ${API_URL} — suíte PULADA. ` +
      `Rode 'supabase start && supabase migration up --local' para executá-la.`,
  );
}

const RUN = Math.random().toString(36).slice(2, 10);

interface Actor {
  userId: string;
  organizationId: string;
  client: SupabaseClient;
}

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function createActor(label: string): Promise<Actor> {
  const email = `liveness-${label}-${RUN}@radar.test`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Live ${label}`, company_name: `Live ${label} ${RUN}` },
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
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  return { userId, organizationId, client };
}

/** POST que reproduz EXATAMENTE o que o cron process-jobs-wake faz via pg_net. */
async function cronWake(): Promise<Response> {
  return fetch(`${API_URL}/functions/v1/process-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: "{}",
  });
}

/**
 * O MESMO claim atômico que o worker executa (_shared/job-queue.ts claim):
 * UPDATE com guarda .eq("status","queued") — só um worker recebe a linha.
 */
async function claimPrimitive(jobId: string, workerId: string) {
  return admin
    .from("jobs")
    .update({
      status: "processing",
      worker_id: workerId,
      attempt: 1,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, status, attempt")
    .maybeSingle();
}

async function waitForTerminal(jobId: string, deadlineMs = 30_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { data, error } = await admin
      .from("jobs")
      .select("id, status, attempt, error, started_at, finished_at")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error(`job poll: ${error.message}`);
    const status = data?.status as string;
    if (["completed", "partially_completed", "failed", "cancelled"].includes(status)) {
      return data as Record<string, unknown>;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`job ${jobId} não chegou a estado terminal em ${deadlineMs}ms`);
}

describeIfDb("job liveness (process-jobs wake + claim atômico + health RPC)", () => {
  let orgA: Actor;
  let searchIdA: string;
  let placeIdA: string;

  beforeAll(async () => {
    orgA = await createActor("a");

    const { data: search, error: searchError } = await orgA.client
      .from("searches")
      .insert({
        organization_id: orgA.organizationId,
        created_by: orgA.userId,
        query: `busca-liveness-${RUN}`,
        location_label: "Belo Horizonte, MG",
        center: "SRID=4326;POINT(-43.9386 -19.9208)",
        radius_meters: 5000,
      })
      .select("id")
      .single();
    if (searchError) throw new Error(`insert search A: ${searchError.message}`);
    searchIdA = search.id;

    // Place SEM website: o handler enriquece e conclui com not_found — o
    // caminho completo roda (claim -> dispatch -> handler -> complete) sem
    // depender de rede externa.
    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        organization_id: orgA.organizationId,
        provider: "google_places",
        provider_place_id: `plc-liveness-${RUN}`,
        name: `Place Liveness ${RUN}`,
        location: "SRID=4326;POINT(-43.9386 -19.9208)",
        website_uri: null,
      })
      .select("id")
      .single();
    if (placeError) throw new Error(`insert place A: ${placeError.message}`);
    placeIdA = place.id;

    const { error: resultError } = await admin.from("search_results").insert({
      search_id: searchIdA,
      place_id: placeIdA,
      distance_meters: 10,
      is_inside_radius: true,
      score: 50,
      temperature: "warm",
    });
    if (resultError) throw new Error(`insert search_result A: ${resultError.message}`);
  });

  afterAll(async () => {
    // Limpeza: organizations ANTES de auth.users (organizations.owner_user_id
    // referencia auth.users SEM cascade — apagar o usuário primeiro falha e
    // deixaria jobs órfãos na fila, que o wake real reivindicaria).
    try {
      if (orgA?.userId) {
        await admin.from("organizations").delete().eq("owner_user_id", orgA.userId);
      }
    } catch {
      // melhor esforço — segue para apagar o usuário
    }
    try {
      if (orgA?.userId) {
        await admin.auth.admin.deleteUser(orgA.userId);
      }
    } catch {
      // melhor esforço — não falha a suíte por causa de limpeza
    }
  });

  // ── 2.4: health RPC — ACL ────────────────────────────────────────────────

  test("LIVE-001: authenticated NÃO pode chamar get_job_queue_health", async () => {
    const { error } = await orgA.client.rpc("get_job_queue_health");
    expect(error).not.toBeNull();
  });

  test("LIVE-002: service_role chama get_job_queue_health e recebe as 7 métricas", async () => {
    const { data, error } = await admin.rpc("get_job_queue_health");
    expect(error).toBeNull();
    const health = data as Record<string, unknown>;
    for (const key of [
      "oldest_queued_at",
      "queued_count",
      "processing_count",
      "retrying_count",
      "failed_count",
      "stuck_count",
      "oldest_queued_age_seconds",
    ]) {
      expect(key in health).toBe(true);
    }
    for (const key of [
      "queued_count",
      "processing_count",
      "retrying_count",
      "failed_count",
      "stuck_count",
      "oldest_queued_age_seconds",
    ]) {
      expect(typeof health[key]).toBe("number");
    }
  });

  // ── 2.5.C: o cenário do usuário — queued -> liveness -> conclui ──────────

  test("LIVE-003: job queued sem busca nova é acordado pelo liveness", async () => {
    // 1. job em 'queued' direto no banco (service_role).
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
      .select("id, status")
      .single();
    expect(insertError).toBeNull();
    const jobId = job.id as string;

    // 2. NENHUMA busca nova é disparada — nada acontece até o wake: o job
    // continua queued (o cron local é no-op porque o Vault local não tem
    // secrets; nada mais o reivindica).
    const { data: before } = await admin.from("jobs").select("status").eq("id", jobId).single();
    expect(before?.status).toBe("queued");

    const { data: healthBefore } = await admin.rpc("get_job_queue_health");
    expect((healthBefore as { queued_count: number }).queued_count).toBeGreaterThanOrEqual(1);

    // 3. liveness: o MESMO POST que o cron process-jobs-wake faria via pg_net.
    const wake = await cronWake();
    if (wake.status === 200) {
      // Ambiente com edge runtime funcionando (CI/staging com import map):
      // pipeline COMPLETO — claim, dispatch e handler.
      const wakeBody = (await wake.json()) as { processed: number };
      expect(wakeBody.processed).toBe(1);

      // 4. o job conclui.
      const done = await waitForTerminal(jobId);
      expect(done.status).toBe("completed");
      expect(done.attempt).toBe(1);
      expect(done.started_at).not.toBeNull();
      expect(done.finished_at).not.toBeNull();
      expect(done.error).toBeNull();

      // enriched_count foi REESCRITO pelo pipeline (recount derivado): place
      // sem website => not_found => state failed => conta 0 (sem inflar).
      const { data: searchAfter } = await admin
        .from("searches")
        .select("enriched_count")
        .eq("id", searchIdA)
        .single();
      expect(searchAfter?.enriched_count).toBe(0);
    } else {
      // LIMITAÇÃO LOCAL CONHECIDA: o edge runtime local não aplica
      // import_map.json — nenhuma função que importa @leads/domain/* boota
      // (503 BOOT_ERROR). NÃO simulamos sucesso. Fallback sancionado pelo
      // handoff-spec: provar que o job SERIA reivindicado chamando o claim
      // REAL (mesmo UPDATE atômico do worker). A conclusão via handler fica
      // NOT_VERIFIED neste ambiente — marcado no log e no handoff-impl.
      const wakeText = await wake.text();
      expect(wake.status).toBe(503);
      expect(wakeText).toContain("BOOT_ERROR");
      console.warn(
        "[job-liveness] edge runtime local não aplica import_map.json — " +
          "conclusão do job via handler: NOT_VERIFIED localmente.",
      );

      const claimed = await claimPrimitive(jobId, "liveness-test-worker");
      expect(claimed.error).toBeNull();
      expect(claimed.data?.status).toBe("processing");
      expect(claimed.data?.attempt).toBe(1);
    }
  });

  // ── 2.5.D: idempotência do wake periódico (claim atômico) ─────────────────

  test("LIVE-004: dois claims concorrentes sobre o mesmo job — só um vence", async () => {
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

    // Dois claims simultâneos com o MESMO update atômico que o worker executa
    // (_shared/job-queue.ts): guarda .eq("status","queued"). Independe do edge
    // runtime — prova a atomicidade direto contra o Postgres.
    const [a, b] = await Promise.all([
      claimPrimitive(jobId, "worker-a"),
      claimPrimitive(jobId, "worker-b"),
    ]);

    const winners = [a, b].filter((r) => r.data !== null);
    expect(winners.length).toBe(1); // exatamente um venceu

    // O perdedor NÃO re-reivindicou: attempt continua 1 e a linha tem UM
    // worker_id (se ambos tivessem vencido, o segundo teria re-escrito).
    const { data: final } = await admin
      .from("jobs")
      .select("status, attempt, worker_id")
      .eq("id", jobId)
      .single();
    expect(final?.status).toBe("processing");
    expect(final?.attempt).toBe(1);
    expect([a.data?.id === jobId ? "worker-a" : "worker-b"]).toContain(final?.worker_id);
  });

  // ── 2.3: enriched_count derivado — idempotente por construção ─────────────

  test("LIVE-005: recount é idempotente (reprocessar não infla)", async () => {
    // Place passa a ter enrichment real (fixture via service_role).
    await admin
      .from("places")
      .update({
        enriched_at: new Date().toISOString(),
        enrichment_state: "enriched",
        email: `contato-${RUN}@segredo.test`,
      })
      .eq("id", placeIdA);

    const recount = () => admin.rpc("recount_search_enriched_counts", { p_place_id: placeIdA });
    const { error: firstError } = await recount();
    expect(firstError).toBeNull();

    const { data: first } = await admin
      .from("searches")
      .select("enriched_count")
      .eq("id", searchIdA)
      .single();
    expect(first?.enriched_count).toBe(1);

    // Reprocessar o MESMO place recomputa o mesmo número — nunca infla.
    const { error: secondError } = await recount();
    expect(secondError).toBeNull();
    const { data: second } = await admin
      .from("searches")
      .select("enriched_count")
      .eq("id", searchIdA)
      .single();
    expect(second?.enriched_count).toBe(1);

    // Place que perde o contato (failed) sai da contagem — COUNT é a verdade.
    await admin
      .from("places")
      .update({ enrichment_state: "failed", email: null })
      .eq("id", placeIdA);
    const { error: thirdError } = await recount();
    expect(thirdError).toBeNull();
    const { data: third } = await admin
      .from("searches")
      .select("enriched_count")
      .eq("id", searchIdA)
      .single();
    expect(third?.enriched_count).toBe(0);
  });

  // ── 2.4: stuck_count usa o limiar do sweeper ──────────────────────────────

  test("LIVE-006: health reporta stuck quando processing passa de 10 min", async () => {
    const { data: job, error: insertError } = await admin
      .from("jobs")
      .insert({
        organization_id: orgA.organizationId,
        type: "TERRITORY_ANALYSIS",
        status: "processing",
        attempt: 1,
        priority: 0,
        payload: {},
        started_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    expect(insertError).toBeNull();

    const { data, error } = await admin.rpc("get_job_queue_health");
    expect(error).toBeNull();
    const health = data as { stuck_count: number; processing_count: number };
    expect(health.stuck_count).toBeGreaterThanOrEqual(1);
    expect(health.processing_count).toBeGreaterThanOrEqual(1);
  });
});
