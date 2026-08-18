-- ============================================================================
-- FASE 1 — SECURITY REMEDIATION — P0-1, P0-2, P0-4 (+ Fase 1b e 1c)
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores. Baseline: PROSPECA MATURITY REVIEW — Security 48/100.
--
-- P0-1 — LEITURA DE PII CROSS-TENANT via get_search_discovery
--   A função é SECURITY DEFINER (bypassa RLS) e aceitava o organization_id
--   enviado pelo chamador como PROVA de membership ("fast path"). Qualquer
--   cliente autenticado podia passar o org id de OUTRO tenant e ler o PII de
--   contato (email/instagram/whatsapp/telefone) dos places daquele tenant.
--   Correção: autorização passa a ser SEMPRE
--   public.is_organization_member(s.organization_id) — resolve auth.uid() do
--   JWT, que o chamador não consegue forjar. p_organization_id CONTINUA
--   aceito (o cliente em produção já o envia) mas vira apenas FILTRO opcional:
--   só pode REMOVER linhas, nunca conceder acesso.
--   Assinatura preservada EXATAMENTE (p_search_id uuid, p_organization_id uuid
--   default null) — assinatura diferente criaria um OVERLOAD e deixaria a
--   função vulnerável viva. A versão antiga de
--   20260723000005_get_search_discovery_contact.sql tem a MESMA assinatura e
--   já foi substituída via create or replace em 20260812000002 — não existe
--   segunda função ativa para corrigir ou dropar.
--
-- P0-1 (Fase 1b) — LEITURA CROSS-TENANT via get_saved_searches
--   MESMO padrão do get_search_discovery: SECURITY DEFINER (bypassa RLS),
--   filtrava apenas por `s.organization_id = p_organization_id` sem membership
--   check — qualquer cliente autenticado lia as missões salvas de outro tenant
--   (query, nicho, localização, raio, nome da missão, coordenadas, estatísticas
--   de resultados). Correção mínima: mantém `language sql` e adiciona
--   `and public.is_organization_member(p_organization_id)` ao WHERE — retorna
--   zero linhas em vez de raise, coerente com a semântica de RLS e sem quebrar
--   o cliente (mesmo padrão de leitura usado no get_dashboard_overview).
--   ACL da original mantido como está (revoke from public, anon; grant to
--   authenticated) — já era correto.
--
-- P0-2 — ESCRITA ANÔNIMA EM BILLING (increment_usage_counter + 3 RPCs de leitura)
--   increment_usage_counter era SECURITY DEFINER sem membership check e
--   executável por anon: qualquer um podia inflar o contador de uso de
--   QUALQUER organização. get_quota_status / get_usage_summary /
--   get_organization_entitlements também eram executáveis por anon (e por
--   qualquer authenticated, cross-tenant).
--   Levantamento de chamadores (Maestro, verificado): os 4 são chamados
--   SOMENTE por edge functions via service_role (adminClient). Nenhum caminho
--   do browser usa essas RPCs. Decisão: INTERNAL-ONLY — revoke de
--   anon/authenticated/public, grant só para service_role.
--   increment_usage_counter ganha validação de domínio fail-closed:
--     * p_quantity <= 0 rejeitada (contador nunca decrementa por esta via);
--     * p_quantity acima do teto rejeitada (um upsert de uso não recebe
--       milhões de unidades de uma vez — teto = 1.000.000);
--     * p_period_end < p_period_start rejeitada.
--   Upsert atômico com ON CONFLICT mantido (sem read-modify-write).
--
-- P0-4 — GRANTS ABERTOS POR DEFAULT (causa-raiz)
--   20260720000003 fez `grant execute on all functions in schema public to
--   anon, authenticated` e repetiu via `alter default privileges` — toda
--   função nova nascia executável por anon. Daqui pra frente: deny-by-default.
--
-- Por que anon NÃO precisa de EXECUTE em NENHUMA função de `public`:
--   * signup/login/reset de senha vivem no schema `auth` (GoTrue) e não usam
--     RPC em `public`;
--   * as únicas leituras anônimas do produto (billing_plans/founder_offer na
--     landing/preços) são tabelas com policy `using (true)` — nenhuma função;
--   * handle_new_user() roda como TRIGGER — o ACL do trigger é verificado no
--     CREATE TRIGGER (feito pela migration como postgres); no disparo não há
--     checagem de ACL da função, então o signup continua funcionando;
--   * chamadas RPC do browser acontecem SEMPRE com sessão (role
--     `authenticated`), nunca com anon;
--   * `authenticated` mantém EXECUTE em massa (revogar quebraria o app) — a
--     proteção passa a ser o membership check DENTRO de cada função.
--   NÃO reintroduza `grant execute ... to anon`. Se uma página nova precisar
--   de função anônima, exponha via edge function com service_role.
--
-- Nota sobre `public`: além do grant explícito a `anon`, toda função nasce com
-- EXECUTE implícito para a pseudo-role PUBLIC (default do PostgreSQL) — que
-- também alcança `anon`. Por isso o revoke em massa abaixo remove TAMBÉM o
-- grant de PUBLIC; `authenticated` e `service_role` não perdem nada porque têm
-- grants explícitos (20260720000003 + default privileges).
-- ============================================================================

-- ── 1.2 + P0-4: deny-by-default para anon ───────────────────────────────────
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;

-- Fecha o canal residual: EXECUTE implícito para PUBLIC (default do PG), que
-- também alcança anon. authenticated/service_role seguem com grants explícitos.
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;

-- ── 1.1 P0-1: get_search_discovery — membership é a ÚNICA autorização ──────
create or replace function public.get_search_discovery(
  p_search_id uuid,
  p_organization_id uuid default null
)
returns table (
  place_id uuid,
  name text,
  category text,
  latitude double precision,
  longitude double precision,
  formatted_address text,
  address_components jsonb,
  search_location_label text,
  national_phone_number text,
  website_uri text,
  has_website boolean,
  email text,
  instagram text,
  whatsapp text,
  rating numeric,
  review_count integer,
  distance_meters integer,
  is_inside_radius boolean,
  score integer,
  temperature text,
  imported_lead_id uuid,
  enrichment_state text,
  enrichment_fields jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as place_id,
    p.name,
    p.primary_type as category,
    st_y(p.location::geometry) as latitude,
    st_x(p.location::geometry) as longitude,
    p.formatted_address,
    p.address_components,
    s.location_label as search_location_label,
    p.national_phone_number,
    p.website_uri,
    (p.website_uri is not null and p.website_uri <> '') as has_website,
    p.email,
    p.instagram,
    p.whatsapp,
    p.rating,
    p.user_rating_count as review_count,
    sr.distance_meters,
    sr.is_inside_radius,
    sr.score,
    sr.temperature,
    sr.imported_lead_id,
    p.enrichment_state,
    p.enrichment_fields
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  where sr.search_id = p_search_id
    -- Autorização: SEMPRE pelo membership do JWT (auth.uid()). O antigo
    -- "fast path" que autorizava por p_organization_id foi REMOVIDO — era o
    -- vetor de leitura de PII cross-tenant (P0-1).
    and public.is_organization_member(s.organization_id)
    -- p_organization_id é aceito por compatibilidade com o cliente em
    -- produção, mas é apenas FILTRO opcional: só pode REMOVER linhas, nunca
    -- conceder acesso.
    and (p_organization_id is null or s.organization_id = p_organization_id)
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;

-- ── 1.1b P0-1 (Fase 1b): get_saved_searches — membership check no WHERE ────
-- Assinatura EXATA da original (20260812000003_saved_searches.sql:16):
--   public.get_saved_searches(p_organization_id uuid)
-- com o MESMO returns table de 17 colunas. Correção mínima em `language sql`:
--   and public.is_organization_member(p_organization_id)
-- Zero linhas (em vez de raise) é coerente com a semântica de RLS e não quebra
-- o cliente. ACL da original é mantido (revoke from public, anon; grant to
-- authenticated) — sem mudanças.
create or replace function public.get_saved_searches(p_organization_id uuid)
returns table (
  search_id uuid,
  query text,
  category text,
  location_label text,
  radius_meters integer,
  presence_filter text,
  status text,
  found_count integer,
  imported_count integer,
  created_at timestamptz,
  saved_name text,
  latitude double precision,
  longitude double precision,
  total_results integer,
  hot_count integer,
  avg_score integer,
  without_website integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.query,
    s.category,
    s.location_label,
    s.radius_meters,
    s.presence_filter,
    s.status,
    s.found_count,
    s.imported_count,
    s.created_at,
    s.saved_name,
    st_y(s.center::geometry) as latitude,
    st_x(s.center::geometry) as longitude,
    count(sr.id) as total_results,
    count(*) filter (where sr.temperature = 'hot') as hot_count,
    coalesce(round(avg(sr.score)), 0)::integer as avg_score,
    count(*) filter (where p.website_uri is null or p.website_uri = '') as without_website
  from public.searches s
  left join public.search_results sr on sr.search_id = s.id
  left join public.places p on p.id = sr.place_id
  where s.organization_id = p_organization_id
    -- Membership check (P0-1): o org id do parâmetro NÃO é prova de
    -- membership — a autorização vem de auth.uid() via JWT.
    and public.is_organization_member(p_organization_id)
    and s.is_saved
  group by s.id
  order by s.created_at desc;
$$;

-- ── 1.3 P0-2: RPCs de billing/quota viram INTERNAL-ONLY ─────────────────────
-- Assinaturas lidas das migrations originais (revoke sem a assinatura exata
-- falharia ou miraria a função errada):
--   get_quota_status(uuid)                                  — 20260719000006
--   get_usage_summary(uuid, timestamptz, timestamptz)       — 20260724000004
--   get_organization_entitlements(uuid)                     — 20260729000002
--   increment_usage_counter(uuid, text, date, date, bigint) — 20260729000002

revoke execute on function public.get_quota_status(uuid) from anon, authenticated, public;
grant execute on function public.get_quota_status(uuid) to service_role;

revoke execute on function public.get_usage_summary(uuid, timestamptz, timestamptz) from anon, authenticated, public;
grant execute on function public.get_usage_summary(uuid, timestamptz, timestamptz) to service_role;

revoke execute on function public.get_organization_entitlements(uuid) from anon, authenticated, public;
grant execute on function public.get_organization_entitlements(uuid) to service_role;

revoke execute on function public.increment_usage_counter(uuid, text, date, date, bigint) from anon, authenticated, public;
grant execute on function public.increment_usage_counter(uuid, text, date, date, bigint) to service_role;

-- ── 1.3 P0-2: increment_usage_counter — validação de domínio fail-closed ────
-- Mesma assinatura da original (p_organization_id uuid, p_metric text,
-- p_period_start date, p_period_end date, p_quantity bigint) returns void.
create or replace function public.increment_usage_counter(
  p_organization_id uuid,
  p_metric text,
  p_period_start date,
  p_period_end date,
  p_quantity bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Teto explícito para um único incremento. Racional: esta função é chamada
  -- por evento de negócio (uma busca, um lead processado) via edge function —
  -- um upsert legítimo nunca carrega milhões de unidades de uma vez. Valores
  -- acima disso indicam bug de loop ou tentativa de inflar o billing. O teto
  -- é folgado de propósito para nunca barrar uso legítimo.
  v_max_quantity constant bigint := 1000000;
begin
  -- Fail-closed: mensagens genéricas (não vazam dados do tenant).
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid usage quantity' using errcode = '22023';
  end if;
  if p_quantity > v_max_quantity then
    raise exception 'invalid usage quantity' using errcode = '22023';
  end if;
  if p_period_end < p_period_start then
    raise exception 'invalid usage period' using errcode = '22023';
  end if;

  -- Upsert atômico preservado (ON CONFLICT) — sem read-modify-write.
  insert into public.usage_counters (organization_id, metric, period_start, period_end, quantity)
  values (p_organization_id, p_metric, p_period_start, p_period_end, p_quantity)
  on conflict (organization_id, metric, period_start)
  do update set quantity = public.usage_counters.quantity + excluded.quantity, updated_at = now();
end;
$$;

-- ── 1.3b (Fase 1c): funções GLOBAIS security definer viram INTERNAL-ONLY ───
-- P0 NOVO (medido no banco com has_function_privilege): purge_stale_discovery_pii()
-- era security definer SEM escopo de organização e executável por authenticated
-- — qualquer usuário logado, de qualquer tenant/trial, zerava o PII (email,
-- instagram, whatsapp, enriched_at, enrichment_status) de places de TODOS os
-- tenants. Destruição de dados cross-tenant. Deve rodar SÓ pelo pg_cron.
--
-- Varredura completa (todas as funções security definer de public com
-- authenticated=TRUE no banco local) fechou a classe. Resultado:
--   * REVOGADAS abaixo: as globais/purges/sweeper + org_mtd_api_cost_usd (le
--     usage_events/custo de qualquer org; chamadores reais: só edge functions
--     via service_role) + handle_new_user (trigger — authenticated nunca
--     precisa executá-la; trigger não tem checagem de ACL no disparo, então o
--     signup continua funcionando).
--   * MANTIDAS para authenticated de propósito (verificadas): as 7 RPCs do
--     browser (get_search_discovery, get_saved_searches, get_dashboard_overview,
--     move_lead_stage, record_lead_contact, is_platform_admin,
--     get_admin_job_metrics), os admin RPCs que rodam com o JWT do usuário via
--     edge functions (userClient) e têm gate interno is_platform_admin
--     (get_admin_overview, get_admin_orgs, get_admin_timeseries, set_org_budget,
--     get_admin_job_counts, get_admin_jobs), e os helpers de policy RLS
--     (is_organization_member, has_organization_role) — revogar esses quebraria
--     o app ou as policies.
--
-- pg_cron verificado: os 7 cron jobs rodam como role postgres (superuser,
-- bypassa ACL) — nenhum depende de EXECUTE para authenticated.
--
-- Assinaturas exatas (lidas das migrations originais antes do revoke):
--   purge_stale_discovery_pii()                     — 20260723000006 (ret integer)
--   purge_stale_discovery_google_content()          — 20260723000011 (ret integer)
--   org_mtd_api_cost_usd(uuid)                      — 20260724000004 (ret numeric)
--   purge_rate_limit_events()                       — 20260730000004 (ret integer)
--   purge_error_events()                            — 20260730000006 (ret integer)
--   recover_stuck_jobs()                            — 20260815000002 (ret void)
--   handle_new_user()                               — 20260719000001 (ret trigger)

revoke execute on function public.purge_stale_discovery_pii() from anon, authenticated, public;
grant execute on function public.purge_stale_discovery_pii() to service_role;

revoke execute on function public.purge_stale_discovery_google_content() from anon, authenticated, public;
grant execute on function public.purge_stale_discovery_google_content() to service_role;

revoke execute on function public.org_mtd_api_cost_usd(uuid) from anon, authenticated, public;
grant execute on function public.org_mtd_api_cost_usd(uuid) to service_role;

revoke execute on function public.purge_rate_limit_events() from anon, authenticated, public;
grant execute on function public.purge_rate_limit_events() to service_role;

revoke execute on function public.purge_error_events() from anon, authenticated, public;
grant execute on function public.purge_error_events() to service_role;

revoke execute on function public.recover_stuck_jobs() from anon, authenticated, public;
grant execute on function public.recover_stuck_jobs() to service_role;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.handle_new_user() to service_role;
