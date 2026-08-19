// Testes REAIS da unificação de score (Fase 3) — Postgres local + edge
// functions. Migration 20260817000019_unify_leads_score_v2.
//
// Prova:
//   1. lead COM V2 em company_opportunity_scores: calculate-lead-score copia o
//      V2 (score/version/temperature/breakdown) e PRESERVA o v3 em
//      score_legacy_v3 (rollback);
//   2. lead SEM V2: permanece com o número legado marcado 'legacy-v3.0.0' —
//      nunca 0, nunca vazio;
//   3. score-company (escritor único do V2) sincroniza leads.score na mesma
//      operação — o MESMO número da descoberta;
//   4. ordenação por score continua funcionando sobre a coluna materializada.
//
// REGRA DE INFRA: suite roda SOZINHA com --parallel=1. Fixtures FK-safe.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// A versão vem da ENGINE, nunca escrita à mão: um bump de fórmula (v1.2.0 →
// v1.3.0, decisor na contatabilidade) já quebrou este teste duas vezes por
// literal defasado, escondendo o que de fato importa — que o escritor único
// sincroniza leads.score com o V2 corrente, seja qual for a versão.
import { OPPORTUNITY_SCORE_VERSION } from "@leads/domain";

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
    `[score-unification] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(`[score-unification] Supabase local não acessível em ${API_URL} — suíte PULADA.`);
}

const RUN = Math.random().toString(36).slice(2, 10);

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Actor {
  userId: string;
  organizationId: string;
  client: SupabaseClient;
}

async function createActor(label: string): Promise<Actor> {
  const email = `scoreuni-${label}-${RUN}@example.com`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Score ${label}`, company_name: `Score ${label} ${RUN}` },
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

  const userClient = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  return { userId, organizationId, client: userClient };
}

/** Invoca calculate-lead-score como o usuário (HTTP direto na function). */
async function recalcLeads(
  actor: Actor,
  leadIds: string[],
): Promise<{ updated: number; legacyCount: number }> {
  const { data } = await actor.client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("sem token");
  const res = await fetch(`${API_URL}/functions/v1/calculate-lead-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ leadIds }),
  });
  if (!res.ok) throw new Error(`calculate-lead-score ${res.status}: ${await res.text()}`);
  return (await res.json()) as { updated: number; legacyCount: number };
}

describeIfDb("unificação de score (Fase 3): leads.score = V2, v3 legado preservado", () => {
  let org: Actor;
  let placeWithV2: string;
  let leadWithV2: string;
  let leadWithoutV2: string;
  let leadForSync: string;

  beforeAll(async () => {
    org = await createActor("org");

    async function insertPlace(marker: string): Promise<string> {
      const { data, error } = await admin
        .from("places")
        .insert({
          organization_id: org.organizationId,
          provider: "google_places",
          provider_place_id: `scoreuni-${RUN}-${marker}`,
          name: `Score Target ${marker}`,
          primary_type: "restaurant",
          website_uri: null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert place ${marker}: ${error.message}`);
      return data.id;
    }

    async function insertLead(
      marker: string,
      placeId: string,
      score: number,
      version: string,
    ): Promise<string> {
      const { data, error } = await admin
        .from("leads")
        .insert({
          organization_id: org.organizationId,
          created_by: org.userId,
          company_name: `Lead ${marker}`,
          city: "Porto Alegre",
          place_id: placeId,
          score,
          score_rule_version: version,
          temperature: "cold",
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert lead ${marker}: ${error.message}`);
      return data.id;
    }

    // Place com V2 persistido (o que a descoberta mostra) + lead com v3.
    placeWithV2 = await insertPlace("withv2");
    const { error: v2Error } = await admin.from("company_opportunity_scores").insert({
      organization_id: org.organizationId,
      place_id: placeWithV2,
      score: 72,
      temperature: "hot",
      rule_version: OPPORTUNITY_SCORE_VERSION,
      confidence: 0.85,
      breakdown: {
        total: 72,
        confidence: 0.85,
        components: [
          { key: "digital_gap", label: "Presença digital", score: 40, reason: "Sem site" },
        ],
        scoreState: "FINALIZADO",
        version: OPPORTUNITY_SCORE_VERSION,
      },
    });
    if (v2Error) throw new Error(`insert v2: ${v2Error.message}`);
    leadWithV2 = await insertLead("withv2", placeWithV2, 41, "v3.0.0");

    // Place SEM V2 (nunca escoreado) + lead com v3.
    const placeNoV2 = await insertPlace("nov2");
    leadWithoutV2 = await insertLead("nov2", placeNoV2, 33, "v3.0.0");

    // Place/lead para o teste de sincronia do score-company.
    const placeSync = await insertPlace("sync");
    leadForSync = await insertLead("sync", placeSync, 20, "v3.0.0");
  });

  afterAll(async () => {
    if (!org?.userId) return;
    try {
      await admin.from("organizations").delete().eq("owner_user_id", org.userId);
    } catch {
      /* melhor esforço */
    }
    try {
      await admin.auth.admin.deleteUser(org.userId);
    } catch {
      /* melhor esforço */
    }
  });

  /** Place extra criado sob demanda (o insertPlace do beforeAll é local a ele). */
  async function insertPlaceForBump(): Promise<string> {
    const { data, error } = await admin
      .from("places")
      .insert({
        organization_id: org.organizationId,
        provider: "google_places",
        provider_place_id: `score-bump-${RUN}`,
        name: `Place bump ${RUN}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert place bump: ${error.message}`);
    return data.id;
  }

  async function leadRow(id: string) {
    const { data, error } = await admin
      .from("leads")
      .select("score, score_rule_version, temperature, score_legacy_v3")
      .eq("id", id)
      .single();
    if (error) throw new Error(`select lead: ${error.message}`);
    return data;
  }

  test("lead COM V2: calculate-lead-score copia o V2 e preserva o v3 para rollback", async () => {
    const res = await recalcLeads(org, [leadWithV2]);
    expect(res.updated).toBeGreaterThanOrEqual(1);

    const row = await leadRow(leadWithV2);
    expect(row.score).toBe(72);
    expect(row.score_rule_version).toBe(OPPORTUNITY_SCORE_VERSION);
    expect(row.temperature).toBe("hot");
    expect(row.score_legacy_v3).toBe(41);
  });

  test("lead SEM V2: mantém o número legado marcado 'legacy-v3.0.0' (nunca 0)", async () => {
    const res = await recalcLeads(org, [leadWithoutV2]);
    expect(res.legacyCount).toBeGreaterThanOrEqual(1);

    const row = await leadRow(leadWithoutV2);
    expect(row.score).toBe(33);
    expect(row.score_rule_version).toBe("legacy-v3.0.0");
  });

  test("score-company (escritor único) sincroniza leads.score com o V2", async () => {
    // Invoca o score-company em modo interno (service key) para o place do lead.
    const res = await fetch(`${API_URL}/functions/v1/score-company`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ organizationId: org.organizationId, placeIds: [placeWithV2] }),
    });
    if (!res.ok) throw new Error(`score-company ${res.status}: ${await res.text()}`);

    // O lead do MESMO place foi sincronizado para o V2 recém-computado.
    const row = await leadRow(leadWithV2);
    expect(row.score_rule_version).toBe(OPPORTUNITY_SCORE_VERSION);
    const { data: cos } = await admin
      .from("company_opportunity_scores")
      .select("score")
      .eq("organization_id", org.organizationId)
      .eq("place_id", placeWithV2)
      .eq("rule_version", OPPORTUNITY_SCORE_VERSION)
      .single();
    expect(row.score).toBe(cos?.score as number);
  });

  test("BUMP DE VERSÃO NÃO destrói o v3 guardado para rollback", async () => {
    // Bug latente encontrado ao subir a engine de v1.2.0 para v1.3.0: a
    // preservação testava `score_rule_version !== OPPORTUNITY_SCORE_VERSION`,
    // o que parecia equivalente a "ainda é legado" ENQUANTO a versão nunca
    // mudou. No primeiro bump, um lead já em V2 passa no teste e grava o score
    // V2 ANTERIOR por cima do v3 original — o rollback prometido pela migration
    // 20260817000019 sumiria em silêncio, sem erro e sem log.
    //
    // A condição correta olha SE O NÚMERO ATUAL É O LEGADO, não se a versão
    // difere da corrente.
    const placeBump = await insertPlaceForBump();
    const { error: v2Error } = await admin.from("company_opportunity_scores").insert({
      organization_id: org.organizationId,
      place_id: placeBump,
      score: 75,
      temperature: "hot",
      rule_version: OPPORTUNITY_SCORE_VERSION,
      confidence: 0.9,
      breakdown: { total: 75, version: OPPORTUNITY_SCORE_VERSION },
    });
    if (v2Error) throw new Error(`insert v2 bump: ${v2Error.message}`);

    // Lead no estado REAL de produção: já migrado para uma versão V2 ANTERIOR,
    // com o v3 original preservado.
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        organization_id: org.organizationId,
        created_by: org.userId,
        company_name: `Lead bump ${RUN}`,
        city: "Porto Alegre",
        place_id: placeBump,
        score: 72,
        score_rule_version: "v1.2.0-anterior",
        score_legacy_v3: 41,
        temperature: "cold",
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert lead bump: ${error.message}`);

    await recalcLeads(org, [lead.id]);

    const row = await leadRow(lead.id);
    expect(row.score).toBe(75); // adotou o V2 corrente
    expect(row.score_rule_version).toBe(OPPORTUNITY_SCORE_VERSION);
    // O v3 ORIGINAL sobrevive — não foi substituído pelo score V2 anterior.
    expect(row.score_legacy_v3).toBe(41);
    expect(row.score_legacy_v3).not.toBe(72);
  });

  test("ordenação por score continua correta sobre a coluna materializada", async () => {
    const { data: rows, error } = await admin
      .from("leads")
      .select("id, score")
      .eq("organization_id", org.organizationId)
      .order("score", { ascending: false });
    if (error) throw new Error(`order by: ${error.message}`);
    const scores = (rows ?? []).map((r) => r.score as number);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(scores.length).toBeGreaterThanOrEqual(3);
  });
});
