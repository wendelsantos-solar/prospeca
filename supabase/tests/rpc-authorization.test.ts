// REGRESSÃO ESTÁTICA de autorização de RPCs — Fase 1 Security Remediation.
//
// LIMITAÇÃO HONESTA: este teste NÃO executa SQL. Não existe Postgres nesta
// máquina (pg_isready sem resposta, container ausente) e o gate padrão não
// tem banco. O que este arquivo faz: lê o TEXTO das migrations em
// supabase/migrations e afirma invariantes de segurança sobre a definição
// VIGENTE de cada função (a última migration, em ordem de nome, que a
// redefine). É um teste de regressão estática — ele pega reintrodução
// acidental do fast path vulnerável, perda dos revokes, e assinatura
// divergente em `create or replace` (que criaria um OVERLOAD e deixaria a
// função vulnerável viva). Ele NÃO prova o comportamento em banco; os
// cenários que exigem Postgres vivem em rpc-membership-hardening.test.ts
// (gated por REQUIRE_RLS_DB=true + Supabase local, convenção do repo).
//
// Invariante que NÃO dá para afirmar por texto: nada aqui garante que a
// migration nova foi APLICADA em um banco de verdade. Aplicação é papel do
// pipeline de deploy (supabase db push / migration up), não deste teste.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = new URL("../migrations", import.meta.url).pathname;

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

function allMigrationsText(): string {
  return migrationFiles().map(readMigration).join("\n");
}

/**
 * Última migration (ordem de nome) que contém o trecho dado — a definição
 * VIGENTE vence na ordem lexicográfica de nome de migration, que é a ordem
 * de aplicação do repo.
 */
function latestMigrationContaining(needle: string): string {
  const files = migrationFiles().filter((f) => readMigration(f).includes(needle));
  if (files.length === 0) {
    throw new Error(`nenhuma migration contém: ${needle}`);
  }
  return readMigration(files[files.length - 1]);
}

/**
 * Corpo da definição vigente de uma função: da primeira ocorrência do
 * cabeçalho `create or replace function public.<fn>` até o fechamento `$$;`.
 */
function currentFunctionBody(fn: string): string {
  const text = latestMigrationContaining(`create or replace function public.${fn}`);
  const start = text.indexOf(`create or replace function public.${fn}`);
  if (start === -1) {
    throw new Error(`${fn}: cabeçalho não encontrado na migration vigente`);
  }
  const end = text.indexOf("$$;", start);
  if (end === -1) {
    throw new Error(`${fn}: fechamento $$; não encontrado na migration vigente`);
  }
  return text.slice(start, end);
}

describe("rpc authorization (regressão estática sobre o texto das migrations)", () => {
  test("a migration de hardening existe", () => {
    expect(migrationFiles()).toContain("20260815000011_rpc_membership_hardening.sql");
  });

  test("a migration de liveness (Fase 2) existe", () => {
    expect(migrationFiles()).toContain("20260815000012_process_jobs_liveness.sql");
  });

  test("a migration da carteira (Fase 4) existe", () => {
    expect(migrationFiles()).toContain("20260815000013_dashboard_pipeline_rpcs.sql");
  });

  test("a migration de cost observability (Fase 7) existe", () => {
    expect(migrationFiles()).toContain("20260815000014_cost_observability.sql");
  });

  test("Fase 7: CHECK de usage_events.event_type estendido (mismatch do Motor)", () => {
    const text = readMigration("20260815000014_cost_observability.sql");
    expect(text).toMatch(/drop constraint if exists usage_events_event_type_check/);
    for (const t of [
      "enrich_request",
      "ai_message_generate",
      "cnpj_lookup",
      "place_search_refresh",
    ]) {
      expect(text).toContain(`'${t}'`);
    }
  });

  test("Fase 7: jobs.usage_events ganham real_cost_usd + cost_source + cache_hit", () => {
    const text = readMigration("20260815000014_cost_observability.sql");
    expect(text).toMatch(/alter table public\.jobs/);
    expect(text).toContain("real_cost_usd numeric");
    expect(text).toContain("cost_source");
    expect(text).toContain("cache_hit boolean");
  });

  test("Fase 7b: migration 15 existe com fonte única, backfill do stub e índice", () => {
    expect(migrationFiles()).toContain("20260815000015_provider_cost_table.sql");
    const text = readMigration("20260815000015_provider_cost_table.sql");
    expect(text).toContain("create table if not exists public.provider_cost");
    expect(text).toContain("org_mtd_api_cost_usd(p_organization_id uuid)");
    expect(text).toMatch(/update public\.jobs\s+set estimated_cost = null/);
    expect(text).toContain("idx_usage_events_provider_operation");
    // Ordem de deploy documentada (P2-5): migration ANTES do código novo.
    expect(text).toMatch(/ORDEM DE DEPLOY/);
  });

  test("Fase 7c: provider_cost endurecida — RLS + revokes + vigência temporal", () => {
    expect(migrationFiles()).toContain("20260815000016_provider_cost_hardening.sql");
    const text = readMigration("20260815000016_provider_cost_hardening.sql");
    expect(text).toContain("alter table public.provider_cost enable row level security");
    expect(text).toMatch(
      /revoke select, insert, update, delete on public\.provider_cost from anon, authenticated/,
    );
    expect(text).toContain("valid_from timestamptz");
    expect(text).toContain("valid_to timestamptz");
    // org_mtd casa a taxa VIGENTE na data de cada linha de uso.
    expect(text).toContain("pc.valid_from <= u.created_at");
    expect(text).toContain("pc.valid_to > u.created_at");
    // get_cost_breakdown em UMA passada (sem os grand-totais em scans extras).
    expect(text).toMatch(/with grouped as/);
    expect(text).toContain("sum(est)");
  });

  test("Fase 7b: cost-model.ts e provider_cost não divergem (fonte única)", () => {
    // Números do domínio (cost-model.ts) vs seeds da migration 15.
    const domain = readFileSync(
      new URL("../../packages/domain/src/cost-model.ts", import.meta.url).pathname,
      "utf8",
    );
    const mig = readMigration("20260815000015_provider_cost_table.sql");
    const domainRates = [
      ["place_search_request", "0.035", "0.035"],
      ["place_search_refresh", "0.035", "0.035"],
      ["place_details_request", "0.02", "0.020"],
      ["geocode_request", "0.005", "0.005"],
      ["enrich_request", "0", "0"],
      ["cnpj_lookup", "0", "0"],
    ] as const;
    for (const [op, domainRate, migRate] of domainRates) {
      expect(domain).toContain(`operation: "${op}"`);
      expect(domain).toMatch(
        new RegExp(`operation: "${op}"[\\s\\S]{0,400}?inputCostUsd: ${domainRate}`),
      );
      expect(mig).toMatch(new RegExp(`'${op}',\\s+${migRate},\\s+1,`));
    }
    // anthropic: DESCONHECIDO (null) nos dois lados.
    expect(domain).toMatch(/operation: "ai_message_generate"[\s\S]{0,400}?inputCostUsd: null/);
    expect(mig).toContain("'ai_message_generate',    null,  1,");
  });

  test("get_cost_breakdown tem gate is_platform_admin + bypass de service_role", () => {
    const body = currentFunctionBody("get_cost_breakdown");
    expect(body).toMatch(/if not public\.is_platform_admin\(\)/);
    expect(body).toMatch(/current_setting\('request\.jwt\.claims', true\)::jsonb ->> 'role'/);
    expect(body).toMatch(/errcode = '42501'/);
    expect(body).toContain("'byProviderOperation'");
    expect(body).toContain("'unknownCostCount'");
  });

  // ── Fase 4: RPCs novas do browser com membership check (padrão Fase 1) ───

  const browserRPCsFase4: Array<{ fn: string; sig: string }> = [
    { fn: "get_lead_stage_counts", sig: "uuid" },
    { fn: "get_today_counts", sig: "uuid" },
    { fn: "list_organization_members", sig: "uuid" },
    { fn: "assign_lead", sig: "uuid, uuid" },
    { fn: "resolve_lead_batch", sig: "uuid, uuid[]" },
  ];

  for (const { fn, sig } of browserRPCsFase4) {
    test(`${fn} é browser-RPC endurecida (revoke public/anon + grant authenticated)`, () => {
      const all = allMigrationsText();
      const escaped = sig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(all).toMatch(
        new RegExp(
          `revoke execute on function public\\.${fn}\\(${escaped}\\) from public, anon;`,
          "i",
        ),
      );
      expect(all).toMatch(
        new RegExp(
          `grant execute on function public\\.${fn}\\(${escaped}\\) to authenticated, service_role;`,
          "i",
        ),
      );
      const body = currentFunctionBody(fn);
      expect(body).toMatch(/is_organization_member/);
    });
  }

  test("assign_lead valida que o alvo é membro da MESMA organização", () => {
    const body = currentFunctionBody("assign_lead");
    expect(body).toMatch(/from public\.organization_members/);
    expect(body).toMatch(/where organization_id = v_org and user_id = p_assigned_to/);
  });

  test("get_dashboard_overview continua browser-RPC SEM security definer e com membership check", () => {
    const text = latestMigrationContaining(
      "create or replace function public.get_dashboard_overview",
    );
    const body = currentFunctionBody("get_dashboard_overview");
    // A definição vigente (Fase 4) NÃO pode virar security definer nem perder o gate.
    expect(body).not.toMatch(/security definer/);
    expect(body).toMatch(/if not public\.is_organization_member\(p_organization_id\) then/);
  });

  test("get_dashboard_overview cobre a carteira inteira (allTime + novas métricas)", () => {
    const body = currentFunctionBody("get_dashboard_overview");
    for (const field of [
      "'totalLeads'",
      "'byStage'",
      "'allTime'",
      "'dailySeries'",
      "'channels'",
      "'enrichedCount'",
      "'respondedCount'",
      "'meetingCount'",
      "'proposalCount'",
      "'pipelineCount'",
      "'byStageValue'",
    ]) {
      expect(body).toContain(field);
    }
  });

  // ── Fase 2.1: wake-up do worker por pg_cron ────────────────────────────────

  test("migration de liveness agenda 'process-jobs-wake' no pg_cron", () => {
    const text = readMigration("20260815000012_process_jobs_liveness.sql");
    expect(text).toContain("'process-jobs-wake'");
    expect(text).toMatch(/cron\.schedule\(/);
    expect(text).toContain("'*/2 * * * *'");
    expect(text).toContain("net.http_post");
    expect(text).toContain("/functions/v1/process-jobs");
  });

  test("migration de liveness tem guard de pg_cron e nao falha sem a extensao", () => {
    const text = readMigration("20260815000012_process_jobs_liveness.sql");
    expect(text).toMatch(/if exists \(select 1 from pg_extension where extname = 'pg_cron'\)/);
    expect(text).toMatch(/raise notice 'pg_cron ausente/);
    // Wake no-op sem os secrets do Vault (mesmo padrão de 20260723000015).
    expect(text).toMatch(
      /where exists \(select 1 from vault\.decrypted_secrets where name = 'project_url'\)/,
    );
    expect(text).toMatch(/where name = 'service_role_key'\)/);
  });

  test("migration de liveness referencia Vault e nao embute service_role_key", () => {
    const text = readMigration("20260815000012_process_jobs_liveness.sql");
    expect(text).toContain("vault.decrypted_secrets");
    // Nenhum JWT/key literal suspeito no arquivo.
    expect(text).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/);
  });

  // ── Tarefa 1.1: get_search_discovery ─────────────────────────────────────

  test("get_search_discovery vigente autoriza por is_organization_member", () => {
    const body = currentFunctionBody("get_search_discovery");
    expect(body).toContain("and public.is_organization_member(s.organization_id)");
  });

  test("get_search_discovery vigente NÃO contém o fast path que autoriza por p_organization_id", () => {
    const body = currentFunctionBody("get_search_discovery");
    expect(body).not.toContain(
      "p_organization_id is not null and s.organization_id = p_organization_id",
    );
    // p_organization_id sobrevive apenas como FILTRO opcional.
    expect(body).toContain("(p_organization_id is null or s.organization_id = p_organization_id)");
  });

  test("get_search_discovery: create or replace preserva a assinatura vigente (sem overload)", () => {
    const text = latestMigrationContaining(
      "create or replace function public.get_search_discovery",
    );
    const declarations = text.match(/create or replace function public\.get_search_discovery\(/g);
    // Exatamente UMA declaração na migration vigente: assinatura diferente
    // criaria overload e reintroduziria a função vulnerável.
    expect(declarations?.length ?? 0).toBe(1);

    const signature = text.match(
      /create or replace function public\.get_search_discovery\(([\s\S]*?)\)\nreturns table/,
    );
    expect(signature).not.toBeNull();
    expect(signature![1]).toContain("p_search_id uuid");
    expect(signature![1]).toContain("p_organization_id uuid default null");
  });

  // ── Tarefa 1.1b: get_saved_searches (Fase 1b) ──────────────────────────────

  test("get_saved_searches vigente autoriza por is_organization_member", () => {
    const body = currentFunctionBody("get_saved_searches");
    expect(body).toContain("and public.is_organization_member(p_organization_id)");
  });

  test("get_saved_searches vigente preserva assinatura e colunas da original", () => {
    const text = latestMigrationContaining("create or replace function public.get_saved_searches");
    const declarations = text.match(/create or replace function public\.get_saved_searches\(/g);
    // Sem overload: a original (p_organization_id uuid) é substituída in-place.
    expect(declarations?.length ?? 0).toBe(1);

    const signature = text.match(
      /create or replace function public\.get_saved_searches\(([\s\S]*?)\)\nreturns table/,
    );
    expect(signature).not.toBeNull();
    expect(signature![1]).toContain("p_organization_id uuid");

    const body = currentFunctionBody("get_saved_searches");
    // Mesmo RETURNS TABLE de 17 colunas da original
    // (20260812000003_saved_searches.sql) — colunas a menos quebrariam o
    // cliente; colunas a mais mudariam o contrato da RPC.
    for (const col of [
      "search_id uuid",
      "query text",
      "category text",
      "location_label text",
      "radius_meters integer",
      "presence_filter text",
      "status text",
      "found_count integer",
      "imported_count integer",
      "created_at timestamptz",
      "saved_name text",
      "latitude double precision",
      "longitude double precision",
      "total_results integer",
      "hot_count integer",
      "avg_score integer",
      "without_website integer",
    ]) {
      expect(body).toContain(col);
    }
  });

  // ── Tarefa 1.2: deny-by-default para anon ────────────────────────────────

  test("existe revoke execute em massa de anon sobre functions de public", () => {
    expect(allMigrationsText()).toMatch(
      /revoke execute on all functions in schema public from anon\s*;/i,
    );
  });

  test("existe alter default privileges revogando execute de anon em functions", () => {
    expect(allMigrationsText()).toMatch(
      /alter default privileges in schema public revoke execute on functions from anon\s*;/i,
    );
  });

  test("deny-by-default alcança o canal residual: revoke execute de PUBLIC em functions", () => {
    // Sem revogar de PUBLIC, o EXECUTE implícito (default do PostgreSQL)
    // continuaria deixando anon executar toda função nova.
    expect(allMigrationsText()).toMatch(
      /revoke execute on all functions in schema public from public\s*;/i,
    );
  });

  test("nenhuma migration concede execute a anon em functions de public (exceto a raiz histórica)", () => {
    // Protege o deny-by-default contra REINTRODUÇÃO: qualquer `grant execute`
    // que alcance `anon` fora da migration histórica que criou o defeito
    // (20260720000003, neutralizada pelos revokes da migration de hardening —
    // afirmados nos testes acima) faz este teste falhar. Comentários são
    // ignorados e o statement é lido até o `;` (grants multi-linha são
    // comuns no repo).
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      if (file === "20260720000003_service_role_grants.sql") continue;
      const statements = readMigration(file)
        .split("\n")
        .map((l) => l.replace(/--.*$/, ""))
        .join(" ")
        .match(/grant\s+execute[^;]*;/gi);
      for (const stmt of statements ?? []) {
        const granteePart = stmt.split(/\bto\b/i).pop() ?? "";
        if (/\banon\b/i.test(granteePart)) {
          offenders.push(`${file}: ${stmt.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("nenhuma migration concede execute a PUBLIC em functions (grantee, não schema)", () => {
    // Buraco apontado pela Sentinela no invariante anterior: ele barrava
    // grant a `anon` mas não a `public` — e o EXECUTE implícito para PUBLIC
    // também alcança anon. Aqui a checagem olha o GRANTEE (o trecho depois
    // de `to`) para não confundir com o schema `public` em "in schema public"
    // ou "on function public.fn". Não há isenção histórica: nenhuma migration
    // do repo jamais concedeu execute a public como grantee.
    const offenders: string[] = [];
    for (const file of migrationFiles()) {
      const statements = readMigration(file)
        .split("\n")
        .map((l) => l.replace(/--.*$/, ""))
        .join(" ")
        .match(/grant\s+execute[^;]*;/gi);
      for (const stmt of statements ?? []) {
        const granteePart = stmt.split(/\bto\b/i).pop() ?? "";
        if (/\bpublic\b/i.test(granteePart)) {
          offenders.push(`${file}: ${stmt.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // ── Tarefa 1.3: 4 RPCs internal-only ─────────────────────────────────────

  const internalOnlyRPCs: Array<{ fn: string; sig: string }> = [
    { fn: "get_quota_status", sig: "uuid" },
    { fn: "get_usage_summary", sig: "uuid, timestamptz, timestamptz" },
    { fn: "get_organization_entitlements", sig: "uuid" },
    { fn: "increment_usage_counter", sig: "uuid, text, date, date, bigint" },
    // Fase 1c: funções globais security definer (purges/sweeper/custo/trigger)
    { fn: "purge_stale_discovery_pii", sig: "" },
    { fn: "purge_stale_discovery_google_content", sig: "" },
    { fn: "org_mtd_api_cost_usd", sig: "uuid" },
    { fn: "purge_rate_limit_events", sig: "" },
    { fn: "purge_error_events", sig: "" },
    { fn: "recover_stuck_jobs", sig: "" },
    { fn: "handle_new_user", sig: "" },
    // Fase 2: RPCs novas nascem deny-by-default (não reabrir o P0 da Fase 1)
    { fn: "recount_search_enriched_counts", sig: "uuid" },
    { fn: "get_job_queue_health", sig: "" },
    // Fase 7: custo por provider/operação (admin + service_role via gate)
    { fn: "get_cost_breakdown", sig: "" },
  ];

  for (const { fn, sig } of internalOnlyRPCs) {
    test(`${fn} é internal-only (revoke de anon+authenticated, grant a service_role)`, () => {
      const all = allMigrationsText();
      const revokePattern = new RegExp(
        `revoke execute on function public\\.${fn}\\(${sig}\\) from anon, authenticated(,\\s*public)?\\s*;`,
        "i",
      );
      const grantPattern = new RegExp(
        `grant execute on function public\\.${fn}\\(${sig}\\) to service_role\\s*;`,
        "i",
      );
      expect(all).toMatch(revokePattern);
      expect(all).toMatch(grantPattern);
    });
  }

  // ── Tarefa 1.3: validação de domínio em increment_usage_counter ──────────

  test("increment_usage_counter vigente valida sinal e teto de p_quantity", () => {
    const body = currentFunctionBody("increment_usage_counter");
    expect(body).toMatch(/p_quantity is null or p_quantity <= 0/);
    expect(body).toMatch(/p_quantity > v_max_quantity/);
    expect(body).toMatch(/errcode = '22023'/);
  });

  test("increment_usage_counter vigente valida período e mantém upsert atômico", () => {
    const body = currentFunctionBody("increment_usage_counter");
    expect(body).toMatch(/p_period_end < p_period_start/);
    expect(body).toMatch(/on conflict \(organization_id, metric, period_start\)/);
    // Continua `returns void` — mudança de retorno quebraria os chamadores
    // das edge functions.
    expect(body).toMatch(/returns void/);
  });

  // ── Fase 2.4: health da fila com gate de admin ─────────────────────────────

  test("get_job_queue_health tem gate is_platform_admin + bypass de service_role via JWT role", () => {
    const body = currentFunctionBody("get_job_queue_health");
    expect(body).toMatch(/if not public\.is_platform_admin\(\)/);
    expect(body).toMatch(/current_setting\('request\.jwt\.claims', true\)::jsonb ->> 'role'/);
    expect(body).toMatch(/errcode = '42501'/);
    // Métricas exigidas pelo spec.
    for (const key of [
      "'oldest_queued_at'",
      "'queued_count'",
      "'processing_count'",
      "'retrying_count'",
      "'failed_count'",
      "'stuck_count'",
      "'oldest_queued_age_seconds'",
    ]) {
      expect(body).toContain(key);
    }
    // stuck_count usa o MESMO limiar do sweeper (10 min).
    expect(body).toMatch(/interval '10 minutes'/);
  });

  // ── Fase 2.3: enriched_count derivado por COUNT (idempotente) ─────────────

  test("recount_search_enriched_counts deriva por COUNT e é idempotente por construção", () => {
    const body = currentFunctionBody("recount_search_enriched_counts");
    // COUNT da fonte da verdade, não contador incremental — reprocessar o
    // mesmo place recomputa o mesmo número.
    expect(body).toMatch(/count\(\*\) filter/);
    expect(body).toMatch(/p\.enriched_at is not null/);
    expect(body).toMatch(/p\.enrichment_state in \('enriched', 'partial'\)/);
    // Cobre todas as buscas que contêm o place.
    expect(body).toMatch(/sr2\.place_id = p_place_id/);
  });
});
