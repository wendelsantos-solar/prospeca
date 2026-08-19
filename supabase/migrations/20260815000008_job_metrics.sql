-- Fase 7 — Observabilidade de jobs + estimativa pré-busca (spec #17, #73–75).
--
--  - jobs.duration_ms / jobs.estimated_cost: métricas gravadas pelos handlers
--    (score-company, enrich-company, territory-analysis, process-jobs).
--  - searches.estimated_cost / estimated_results: estimativa persistida pelo
--    create-search (range honesto — ver packages/domain/src/estimate.ts).
--  - get_admin_job_metrics(): agregação por tipo de job para o painel de
--    plataforma — gate is_platform_admin (mesmo padrão de
--    20260813000005_admin_jobs.sql).

alter table public.jobs
  add column if not exists duration_ms integer,
  add column if not exists estimated_cost numeric;

alter table public.searches
  add column if not exists estimated_cost numeric,
  add column if not exists estimated_results integer;

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
      round(coalesce(sum(j.estimated_cost) filter (where j.estimated_cost is not null), 0), 4) as est_cost_usd
    from public.jobs j
    group by j.type
  ) t;
  return result;
end;
$$;

revoke all on function public.get_admin_job_metrics() from public, anon;
grant execute on function public.get_admin_job_metrics() to authenticated, service_role;
