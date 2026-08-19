// Teste de regressão do SIGNUP PÚBLICO (Fase 1d).
//
// MOTIVO: a Fase 1c revogou EXECUTE de authenticated em public.handle_new_user
// (trigger de auth.users que cria profiles + organizations no cadastro). O
// caminho de cadastro público ficou coberto apenas por teste manual do
// Maestro. Este teste reproduz o cadastro EXATAMENTE como o browser faria:
// POST em /auth/v1/signup com a ANON key (sem fixture service_role — o
// objetivo é provar que o caminho ANÔNIMO de cadastro funciona) e afirma as
// DUAS consequências do trigger: uma linha em public.profiles e uma linha em
// public.organizations com owner_user_id = id do usuário.
//
// Se uma migration futura revogar algo que o trigger precise (EXECUTE de
// função, grants nas tabelas que ele insere, ou o próprio trigger), este
// teste quebra no gate com banco.
//
// AUTO-SKIP: mesma convenção do repo (rls-isolation.test.ts) — sem Supabase
// local acessível a suíte é pulada; com REQUIRE_RLS_DB=true e banco ausente,
// o gate falha.
//
// LIMPEZA obrigatória: apaga organizations ANTES de auth.users
// (organizations.owner_user_id referencia auth.users SEM on delete cascade —
// apagar o usuário primeiro falha com organizations_owner_user_id_fkey) e usa
// e-mail único por execução (domínio example.com) — não deixa lixo no banco.
// As credenciais abaixo são as chaves de DEMO fixas do Supabase local (as
// mesmas que `supabase status` imprime em qualquer máquina). Não são segredo
// e não servem para nada fora de 127.0.0.1.

import { afterAll, describe, expect, test } from "bun:test";
import { createClient } from "@supabase/supabase-js";

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
    `[signup-public] Supabase local obrigatório no gate, mas não está acessível em ${API_URL}.`,
  );
}
const describeIfDb = available ? describe : describe.skip;

if (!available) {
  console.warn(
    `[signup-public] Supabase local não acessível em ${API_URL} — suíte PULADA. ` +
      `Rode 'supabase start && supabase migration up --local' para executá-la.`,
  );
}

// Sufixo único por execução — o teste é re-executável sem colidir com cadastros
// anteriores (e sem deixar lixo: a limpeza apaga o que este teste criar).
const RUN = Math.random().toString(36).slice(2, 10);

const admin = createClient(API_URL, SERVICE_KEY, { auth: { persistSession: false } });

describeIfDb("signup público (auth/v1/signup + trigger handle_new_user)", () => {
  const email = `signup-${RUN}@example.com`;
  const password = `Signup-${RUN}-!9x`;
  let userId: string | null = null;

  afterAll(async () => {
    // Limpeza: organizations ANTES de auth.users (FK sem cascade). Melhor
    // esforço — nunca deve mascarar falha do teste em si.
    try {
      if (userId) {
        await admin.from("organizations").delete().eq("owner_user_id", userId);
      }
    } catch {
      // segue para tentar apagar o usuário mesmo assim
    }
    try {
      if (userId) {
        await admin.auth.admin.deleteUser(userId);
      }
    } catch {
      // melhor esforço — não falha a suíte por causa de limpeza
    }
  });

  test("cadastro anônimo cria sessão + profiles + organizations (trigger intacto)", async () => {
    // Caminho PÚBLICO de verdade: exatamente o POST que supabase.auth.signUp
    // faz no browser, com a chave anon — sem fixture de service_role.
    const res = await fetch(`${API_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      access_token?: string;
      user?: { id?: string };
    };

    expect(typeof body.access_token).toBe("string");
    expect((body.access_token ?? "").length).toBeGreaterThan(0);
    expect(body.user?.id).toBeDefined();
    userId = body.user!.id!;

    // Consequência 1 do trigger handle_new_user: linha em profiles.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    expect(profileError).toBeNull();
    expect(profile?.id).toBe(userId);

    // Consequência 2: linha em organizations com owner_user_id = id do usuário.
    const { data: orgs, error: orgsError } = await admin
      .from("organizations")
      .select("id, name")
      .eq("owner_user_id", userId);
    expect(orgsError).toBeNull();
    expect(orgs?.length).toBe(1);
    expect(orgs![0].name).toBe("Minha organização"); // default do trigger sem company_name
  });
});
