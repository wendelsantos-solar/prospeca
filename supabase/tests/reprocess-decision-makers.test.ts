// Reprocessamento da classificação de decisor sobre o QSA BRUTO.
//
// Por que este teste existe: `DECISION_ROLE_RULES` precisa ser "centralizada e
// facilmente ajustável" (brief §26), e ajustável só é verdade se a lista nova
// puder ser aplicada ao que já está no banco. Sem isso, ajustar a tabela muda
// empresas futuras e deixa a base com a classificação velha, em silêncio.
//
// O modelo híbrido (D4) é o que torna isto barato: `places.qsa` guarda o
// snapshot da fonte, então reprocessar NÃO consulta a BrasilAPI.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DECISION_MAKER_SCORE_VERSION } from "@leads/domain";

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
if (!available && process.env.REQUIRE_RLS_DB === "true") {
  throw new Error(`[reprocess-decision-makers] Supabase local obrigatório em ${API_URL}.`);
}
const describeIfDb = available ? describe : describe.skip;
if (!available) {
  console.warn(`[reprocess-decision-makers] Supabase local inacessível — suíte PULADA.`);
}

const RUN = Math.random().toString(36).slice(2, 10);
const admin: SupabaseClient = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

describeIfDb("reprocess-decision-makers (QSA bruto → classificação)", () => {
  let userId: string;
  let organizationId: string;
  let placeId: string;

  beforeAll(async () => {
    const email = `reproc-${RUN}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: `Reproc-${RUN}!x`,
      email_confirm: true,
      user_metadata: { full_name: "Reproc", company_name: `Reproc ${RUN}` },
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    userId = created.user!.id;
    const { data: members } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId);
    organizationId = members![0].organization_id as string;

    // Empresa com QSA BRUTO guardado e NENHUMA relação materializada — o estado
    // de quem foi consultado antes da classificação existir.
    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        organization_id: organizationId,
        provider: "google_places",
        provider_place_id: `reproc-${RUN}`,
        name: `Reproc ${RUN}`,
        registration_fetched_at: new Date().toISOString(),
        qsa: [
          {
            name: `MARIA ${RUN}`,
            qualification: "49-Sócio-Administrador",
            qualificationCode: "49",
            since: "2015-03-10",
            memberType: "person",
            legalRepresentativeName: null,
            legalRepresentativeQualification: null,
          },
          {
            name: `ANA ${RUN}`,
            qualification: "Estagiário",
            qualificationCode: "99",
            since: null,
            memberType: "person",
            legalRepresentativeName: null,
            legalRepresentativeQualification: null,
          },
        ],
      })
      .select("id")
      .single();
    if (placeError) throw new Error(`insert place: ${placeError.message}`);
    placeId = place.id;
  });

  afterAll(async () => {
    if (!userId) return;
    try {
      await admin.from("organizations").delete().eq("owner_user_id", userId);
    } catch {
      /* melhor esforço */
    }
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      /* melhor esforço */
    }
  });

  const reprocess = (body: Record<string, unknown> = {}) =>
    fetch(`${API_URL}/functions/v1/reprocess-decision-makers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId, ...body }),
    }).then((r) => r.json());

  async function relations() {
    const { data, error } = await admin
      .from("company_people")
      .select("role, role_band, decision_score, decision_reasons, people(full_name)")
      .eq("place_id", placeId)
      .order("decision_score", { ascending: false });
    if (error) throw new Error(`select relations: ${error.message}`);
    return data ?? [];
  }

  test("RPD-001: materializa a classificação a partir do QSA guardado", async () => {
    const res = await reprocess();
    expect(res.reprocessed).toBe(1);
    expect(res.peopleWritten).toBe(2);

    const rows = await relations();
    expect(rows.length).toBe(2);
    // Sócio-administrador no topo; estagiário classificado como baixo.
    expect(rows[0].role_band).toBe("high");
    expect(rows[1].role_band).toBe("low");
  });

  test("RPD-002: carimba a versão do score em cada relação", async () => {
    const rows = await relations();
    for (const row of rows) {
      const reasons = row.decision_reasons as { version?: string; reasons?: string[] } | null;
      expect(reasons?.version).toBe(DECISION_MAKER_SCORE_VERSION);
      // Score opaco é proibido (brief §27): sempre há motivo legível.
      expect((reasons?.reasons ?? []).length).toBeGreaterThan(0);
    }
  });

  test("RPD-003: rodar de novo não refaz trabalho (seleção por versão)", async () => {
    const res = await reprocess();
    expect(res.reprocessed).toBe(0);
    expect(res.skipped).toBeGreaterThanOrEqual(1);
  });

  test("RPD-004: força recomputa sem duplicar pessoa nem relação", async () => {
    const res = await reprocess({ force: true });
    expect(res.reprocessed).toBe(1);
    const rows = await relations();
    // Idempotência: continua 2 relações, não 4.
    expect(rows.length).toBe(2);
  });

  test("RPD-005: NÃO consulta fonte externa — empresa sem QSA é ignorada", async () => {
    // Sem QSA guardado não há o que reclassificar, e a função jamais busca o
    // dado: reprocessar é operação de banco, não de rede.
    const { data: semQsa } = await admin
      .from("places")
      .insert({
        organization_id: organizationId,
        provider: "google_places",
        provider_place_id: `reproc-noqsa-${RUN}`,
        name: `Sem QSA ${RUN}`,
      })
      .select("id")
      .single();
    const res = await reprocess({ placeIds: [semQsa!.id] });
    expect(res.candidates).toBe(0);
    expect(res.reprocessed).toBe(0);
  });

  test("RPD-006: usuário comum não pode reprocessar (manutenção é admin-only)", async () => {
    const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: session } = await anon.auth.signInWithPassword({
      email: `reproc-${RUN}@example.com`,
      password: `Reproc-${RUN}!x`,
    });
    const res = await fetch(`${API_URL}/functions/v1/reprocess-decision-makers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session!.session!.access_token}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId }),
    });
    expect(res.status).toBe(403);
  });
});
