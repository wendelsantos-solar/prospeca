-- ============================================================================
-- FASE 7 — COST OBSERVABILITY
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores.
--
-- ORDEM DE DEPLOY (P2-5 da 7b, Lupa): ESTA migration (e a 15) DEVEM ser
-- aplicadas ANTES do código novo das edge functions. O CHECK estendido de
-- usage_events.event_type está AQUI; se o código novo subir primeiro,
-- recordUsage lança nos event_types novos e derruba enrich/export/cnpj/ai em
-- cascata. Sequência correta: migrations primeiro, código depois.
--
-- 7.2 — custo por job: jobs ganha real_cost_usd + cost_source. estimated_cost
--   (existente) continua para a ESTIMATIVA; real_cost_usd é o custo REAL
--   reportado pelo provider. cost_source discrimina 'measured' vs 'estimated'.
--   REGRA DURA da fase: custo DESCONHECIDO é NULL, nunca 0 — 0 só quando
--   comprovadamente zero (cache hit, infra própria, API gratuita).
-- 7.1/7.3 — usage_events: real_cost_usd + cost_source + cache_hit (colunas
--   novas); e o CHECK de event_type é ESTENDIDO (mismatch do Motor: os 4 rate
--   limits inertes usavam event_types que nem passavam no CHECK — enrich_request,
--   ai_message_generate, cnpj_lookup — e place_search_refresh, já gravado por
--   execute-search, também não constava). Todos passam a ser aceitos.
-- 7.4 — get_admin_job_metrics ganha realCostUsd + unknownCostCount (aditivo,
--   contrato antigo preservado) e nova RPC get_cost_breakdown(): custo por
--   provider/operação + cache hit/miss agregado, platform-wide, gate
--   is_platform_admin + bypass de service_role via request.jwt.claims
--   (MESMO padrão de get_job_queue_health da Fase 2). ACL endurecida:
--   revoke de anon/authenticated/public, grant SÓ service_role.
-- ============================================================================

-- ── 7.2: custo real + origem no job ─────────────────────────────────────────
alter table public.jobs
  add column if not exists real_cost_usd numeric,
  add column if not exists cost_source text
    check (cost_source in ('measured', 'estimated'));

-- ── 7.1/7.3: custo real + origem + cache hit em usage_events ────────────────
alter table public.usage_events
  add column if not exists real_cost_usd numeric,
  add column if not exists cost_source text
    check (cost_source in ('measured', 'estimated')),
  add column if not exists cache_hit boolean;

-- ── 7.3: CHECK de event_type estendido (mismatch do Motor) ──────────────────
alter table public.usage_events
  drop constraint if exists usage_events_event_type_check;

alter table public.usage_events
  add constraint usage_events_event_type_check
  check (event_type in (
    'search_request',
    'place_search_request',
    'place_search_refresh',
    'place_details_request',
    'geocode_request',
    'enrichment_request',
    'export_record',
    'enrich_request',
    'ai_message_generate',
    'cnpj_lookup'
  ));

-- ── 7.4: métricas de job com custo real vs estimado (aditivo) ───────────────
create or replace function public.get_admin_job_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]'::jsonb) into result from (
    select
      j.type,
      count(*) as total,
      count(*) filter (where j.status = 'completed') as completed,
      count(*) filter (where j.status = 'failed') as failed,
      count(*) filter (where j.status = 'retrying') as retrying,
      round(avg(j.duration_ms) filter (where j.duration_ms is not null)) as avg_duration_ms,
      round(coalesce(sum(j.estimated_cost) filter (where j.estimated_cost is not null), 0), 4) as est_cost_usd,
      -- Fase 7: custo REAL (provider) separado do estimado; e a contagem de
      -- jobs com custo DESCONHECIDO (NULL) — visível, nunca confundida com 0.
      round(coalesce(sum(j.real_cost_usd) filter (where j.real_cost_usd is not null), 0), 4) as real_cost_usd,
      count(*) filter (where j.real_cost_usd is null and j.cost_source is null) as unknown_cost_count
    from public.jobs j
    group by j.type
  ) t;
  return result;
end;
$$;

-- ACL da get_admin_job_metrics NÃO muda (browser path autenticado com gate —
-- Fase 1 preservada).

-- ── 7.4: custo por provider/operação + cache hit/miss ───────────────────────
create or replace function public.get_cost_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Gate de admin + bypass de service_role via o role do JWT verificado
  -- (request.jwt.claims é setado pelo PostgREST — NÃO forjável). current_user
  -- dentro de SECURITY DEFINER é o owner, por isso o GUC.
  if not public.is_platform_admin()
     and coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'byProviderOperation', (select coalesce(jsonb_agg(jsonb_build_object(
      'provider', coalesce(provider, 'unknown'),
      'operation', event_type,
      'count', c,
      'estCostUsd', round(est, 4),
      'realCostUsd', round(real, 4),
      'cacheHits', ch,
      'cacheMisses', cm,
      'unknownCostCount', unknown_cost
    ) order by est desc, real desc), '[]'::jsonb)
      from (
        select provider, event_type,
          count(*) c,
          coalesce(sum(estimated_cost), 0) est,
          coalesce(sum(real_cost_usd), 0) real,
          count(*) filter (where cache_hit) ch,
          count(*) filter (where coalesce(cache_hit, false) = false) cm,
          -- custo DESCONHECIDO é visível, nunca confundido com zero.
          count(*) filter (where estimated_cost is null and real_cost_usd is null) unknown_cost
        from public.usage_events
        group by provider, event_type
      ) s),
    'grandTotalEstCostUsd', (select coalesce(round(sum(estimated_cost), 4), 0) from public.usage_events),
    'grandTotalRealCostUsd', (select coalesce(round(sum(real_cost_usd), 4), 0) from public.usage_events)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.get_cost_breakdown() from anon, authenticated, public;
grant execute on function public.get_cost_breakdown() to service_role;
