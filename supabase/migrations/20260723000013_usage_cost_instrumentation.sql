-- Fase 1 (custo): instrumentação de custo + guarda-corpo de budget.
-- Custo do Google escala com MISSES, não com nº de buscas — para otimizar
-- precisamos MEDIR (custo/mês, hit-rate) e ter um teto que impeça estouro.

-- Teto de gasto mensal de API por org (USD). NULL = ilimitado (padrão): o
-- guarda-corpo só age depois que a org define um teto. Opt-in, não surpreende.
alter table public.organizations
  add column if not exists monthly_api_budget_usd numeric;

-- Marca a busca cujo fetch pago foi pulado por estouro de budget (serviu só o
-- que o cache deu). Deixa o front avisar "orçamento do mês atingido".
alter table public.searches
  add column if not exists budget_capped boolean not null default false;

-- Custo estimado de API do MÊS CORRENTE (USD) para uma org. Estimativa a
-- calibrar contra a fatura real. Rates por SKU (Places API New):
--   place_search_request  = Text Search Enterprise ~ $0.035/página
--   place_details_request = Place Details Enterprise ~ $0.020
--   geocode_request       = Geocoding ~ $0.005
create or replace function public.org_mtd_api_cost_usd(p_organization_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    u.quantity * case u.event_type
      when 'place_search_request'  then 0.035
      when 'place_details_request' then 0.020
      when 'geocode_request'       then 0.005
      else 0
    end
  ), 0)::numeric
  from public.usage_events u
  where u.organization_id = p_organization_id
    and u.created_at >= date_trunc('month', now());
$$;

-- Resumo de uso + custo estimado + hit-rate numa janela. hit-rate = buscas
-- concluídas que NÃO pagaram Google (provider_request_count = 0) sobre o total
-- concluído. Consumido pelo painel de custo.
create or replace function public.get_usage_summary(
  p_organization_id uuid,
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select event_type, sum(quantity) as q
    from public.usage_events
    where organization_id = p_organization_id
      and created_at >= p_from and created_at < p_to
    group by event_type
  ),
  s as (
    select
      count(*) filter (where status in ('completed', 'partial')) as total,
      count(*) filter (
        where status in ('completed', 'partial') and provider_request_count = 0
      ) as cache_hits
    from public.searches
    where organization_id = p_organization_id
      and created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'searches', (select total from s),
    'cacheHits', (select cache_hits from s),
    'hitRate', case when (select total from s) > 0
                    then round((select cache_hits from s)::numeric / (select total from s), 3)
                    else 0 end,
    'searchPages', coalesce((select q from ev where event_type = 'place_search_request'), 0),
    'placeDetails', coalesce((select q from ev where event_type = 'place_details_request'), 0),
    'geocodes', coalesce((select q from ev where event_type = 'geocode_request'), 0),
    'forcedRefreshes', coalesce((select q from ev where event_type = 'place_search_refresh'), 0),
    'estCostUsd', round(
      coalesce((select q from ev where event_type = 'place_search_request'), 0) * 0.035
      + coalesce((select q from ev where event_type = 'place_details_request'), 0) * 0.020
      + coalesce((select q from ev where event_type = 'geocode_request'), 0) * 0.005, 2)
  );
$$;

revoke all on function public.org_mtd_api_cost_usd(uuid) from public, anon;
revoke all on function public.get_usage_summary(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.org_mtd_api_cost_usd(uuid) to service_role;
grant execute on function public.get_usage_summary(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
