// Testes REAIS do expurgo de PII de registro (LGPD — Fase 90/6c).
// Migration 20260816000018_purge_pii_registry_qsa.
//
// Prova, contra o Postgres local:
//   1. place NÃO convertido com registration_fetched_at vencido (e SEM
//      enriched_at — o ponto cego histórico) tem qsa/registry_email/
//      registry_phone ANULADOS;
//   2. place não convertido com enriched_at vencido anula o grupo contato
//      (email/whatsapp) E, como o registro também venceu, o grupo registro;
//   3. REGRA POR GRUPO: registro fresco + contato vencido → purga SÓ contato
//      (qsa permanece); contato fresco + registro vencido → purga SÓ registro
//      (email permanece);
//   4. place CONVERTIDO (lead no funil) permanece INTACTO — base legal de
//      relacionamento preservada;
//   5. place com timestamps recentes permanece intacto (fora da política).
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
    `[purge-registry-pii] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(`[purge-registry-pii] Supabase local não acessível em ${API_URL} — suíte PULADA.`);
}

const RUN = Math.random().toString(36).slice(2, 10);
const OLD = "2026-03-01T00:00:00Z"; // > 90 dias atrás (fixture determinística)
const FRESH = new Date().toISOString();

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Actor {
  userId: string;
  organizationId: string;
  client: SupabaseClient;
}

async function createActor(label: string): Promise<Actor> {
  const email = `purge-${label}-${RUN}@example.com`;
  const password = `Test-${RUN}-${label}!`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Purge ${label}`, company_name: `Purge ${label} ${RUN}` },
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

  // Sessão de usuário em CLIENTE SEPARADO — jamais sobrescreve a sessão
  // service_role do `admin` (o admin precisa continuar como service_role
  // para os inserts de places/purge).
  const userClient = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session) throw new Error(`signIn(${label}): ${signInError?.message}`);

  return { userId, organizationId, client: userClient };
}

describeIfDb(
  "purge_stale_discovery_pii cobre PII de registro (QSA/registry) por grupo temporal",
  () => {
    let org: Actor;
    let placeOldBoth: string; // contato vencido + registro vencido, não convertido
    let placeRegistryOnly: string; // SÓ registro vencido (ponto cego), não convertido
    let placeRegistryFresh: string; // registro fresco + contato vencido (por-grupo)
    let placeContactFresh: string; // contato fresco + registro vencido (por-grupo)
    let placeRecent: string; // tudo fresco — fora da política
    let placeConverted: string; // convertido — intocável

    beforeAll(async () => {
      org = await createActor("org");

      const base = {
        organization_id: org.organizationId,
        provider: "google_places",
        provider_place_id: `p-${RUN}-`,
        name: `Purge Target ${RUN}`,
      };

      async function insertPlace(marker: string, extra: Record<string, unknown>): Promise<string> {
        const { data, error } = await admin
          .from("places")
          .insert({ ...base, provider_place_id: `${base.provider_place_id}${marker}`, ...extra })
          .select("id")
          .single();
        if (error) throw new Error(`insert place ${marker}: ${error.message}`);
        return data.id;
      }

      placeOldBoth = await insertPlace("oldboth", {
        enriched_at: OLD,
        email: `email-${RUN}@example.com`,
        whatsapp: "+5551999999999",
        registration_fetched_at: OLD,
        qsa: [{ name: `Sócio Velho ${RUN}`, qualification: "49" }],
        registry_email: `socio-${RUN}@example.com`,
        registry_phone: "+5551888888888",
      });

      placeRegistryOnly = await insertPlace("regonly", {
        // SEM enriched_at — nunca passou por enrichment de contato.
        registration_fetched_at: OLD,
        qsa: [{ name: `Sócio Só Registro ${RUN}`, qualification: "22" }],
        registry_email: `regonly-${RUN}@example.com`,
        registry_phone: "+5551777777777",
      });

      placeRegistryFresh = await insertPlace("regfresh", {
        enriched_at: OLD,
        email: `contato-velho-${RUN}@example.com`,
        whatsapp: "+5551666666666",
        registration_fetched_at: FRESH,
        qsa: [{ name: `Sócio Registro Fresco ${RUN}`, qualification: "49" }],
        registry_email: `fresco-${RUN}@example.com`,
      });

      placeContactFresh = await insertPlace("contactfresh", {
        enriched_at: FRESH,
        email: `contato-fresco-${RUN}@example.com`,
        whatsapp: "+5551555555555",
        registration_fetched_at: OLD,
        qsa: [{ name: `Sócio Registro Velho ${RUN}`, qualification: "49" }],
        registry_email: `velho-${RUN}@example.com`,
      });

      placeRecent = await insertPlace("recent", {
        enriched_at: FRESH,
        email: `recente-${RUN}@example.com`,
        registration_fetched_at: FRESH,
        qsa: [{ name: `Sócio Recente ${RUN}`, qualification: "49" }],
        registry_email: `recente-${RUN}@example.com`,
      });

      placeConverted = await insertPlace("converted", {
        enriched_at: OLD,
        email: `convertido-${RUN}@example.com`,
        whatsapp: "+5551444444444",
        registration_fetched_at: OLD,
        qsa: [{ name: `Sócio Convertido ${RUN}`, qualification: "49" }],
        registry_email: `convertido-${RUN}@example.com`,
      });

      // Place CONVERTIDO = tem lead no funil (base legal de relacionamento).
      const { error: leadError } = await admin.from("leads").insert({
        organization_id: org.organizationId,
        created_by: org.userId,
        company_name: `Converted ${RUN}`,
        city: "Porto Alegre",
        place_id: placeConverted,
      });
      if (leadError) throw new Error(`insert lead: ${leadError.message}`);
    });

    afterAll(async () => {
      if (!org?.userId) return;
      try {
        // Cascade: organizações → places/leads.
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

    async function placeRow(id: string) {
      const { data, error } = await admin
        .from("places")
        .select("email, whatsapp, qsa, registry_email, registry_phone, enriched_at")
        .eq("id", id)
        .single();
      if (error) throw new Error(`select place: ${error.message}`);
      return data;
    }

    test("purga os DOIS grupos quando ambos vencem (não convertido)", async () => {
      const { data, error } = await admin.rpc("purge_stale_discovery_pii");
      if (error) throw new Error(`purge: ${error.message}`);
      expect(typeof data).toBe("number");

      const row = await placeRow(placeOldBoth);
      expect(row.email).toBeNull();
      expect(row.whatsapp).toBeNull();
      expect(row.qsa).toBeNull();
      expect(row.registry_email).toBeNull();
      expect(row.registry_phone).toBeNull();
      expect(row.enriched_at).toBeNull();
    });

    test("purga registro MESMO sem enriched_at (ponto cego fechado)", async () => {
      const row = await placeRow(placeRegistryOnly);
      expect(row.qsa).toBeNull();
      expect(row.registry_email).toBeNull();
      expect(row.registry_phone).toBeNull();
    });

    test("regra por grupo: contato vencido + registro fresco → purga SÓ contato", async () => {
      const row = await placeRow(placeRegistryFresh);
      expect(row.email).toBeNull();
      expect(row.qsa).not.toBeNull();
      expect(row.registry_email).not.toBeNull();
    });

    test("regra por grupo: contato fresco + registro vencido → purga SÓ registro", async () => {
      const row = await placeRow(placeContactFresh);
      expect(row.email).not.toBeNull();
      expect(row.qsa).toBeNull();
      expect(row.registry_email).toBeNull();
    });

    test("place recente (fora da política) permanece intacto", async () => {
      const row = await placeRow(placeRecent);
      expect(row.email).not.toBeNull();
      expect(row.qsa).not.toBeNull();
    });

    test("place CONVERTIDO permanece intacto (base legal de relacionamento)", async () => {
      const row = await placeRow(placeConverted);
      expect(row.email).not.toBeNull();
      expect(row.whatsapp).not.toBeNull();
      expect(row.qsa).not.toBeNull();
      expect(row.registry_email).not.toBeNull();
    });
  },
);
