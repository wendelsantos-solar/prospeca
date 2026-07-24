-- Fix: get_admin_overview/get_admin_orgs referenciavam public.memberships, mas a
-- tabela real e public.organization_members. Re-cria as duas com o nome certo
-- (a versao bugada ja tinha sido aplicada no prod; funcoes sao create or replace).

create or replace function public.get_admin_overview(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with ev as (
    select event_type, sum(quantity) as q from public.usage_events
    where created_at >= p_from and created_at < p_to group by event_type
  ),
  s as (
    select
      count(*) filter (where status in ('completed','partial')) as total,
      count(*) filter (where status in ('completed','partial') and provider_request_count = 0) as hits,
      count(*) filter (where status = 'failed') as failed,
      count(*) filter (where coalesce(budget_capped, false)) as capped,
      count(*) filter (where status in ('queued','searching') and created_at < now() - interval '10 minutes') as stuck
    from public.searches where created_at >= p_from and created_at < p_to
  ),
  pages as (select coalesce((select q from ev where event_type = 'place_search_request'), 0) as v),
  details as (select coalesce((select q from ev where event_type = 'place_details_request'), 0) as v),
  geo as (select coalesce((select q from ev where event_type = 'geocode_request'), 0) as v),
  refr as (select coalesce((select q from ev where event_type = 'place_search_refresh'), 0) as v),
  cache as (select count(*) as entries, coalesce(sum(hit_count), 0) as lifetime_hits from public.provider_search_cache)
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orgs', (select count(*) from public.organizations),
    'users', (select count(distinct user_id) from public.organization_members),
    'activeOrgs', (select count(distinct organization_id) from public.searches where created_at >= p_from and created_at < p_to),
    'searches', (select total from s),
    'cacheHits', (select hits from s),
    'hitRate', case when (select total from s) > 0 then round((select hits from s)::numeric / (select total from s), 3) else 0 end,
    'searchPages', (select v from pages),
    'placeDetails', (select v from details),
    'geocodes', (select v from geo),
    'forcedRefreshes', (select v from refr),
    'estCostUsd', round((select v from pages) * 0.035 + (select v from details) * 0.020 + (select v from geo) * 0.005, 2),
    'estSavedUsd', round((select hits from s) * 0.035, 2),
    'cacheEntries', (select entries from cache),
    'cacheLifetimeHits', (select lifetime_hits from cache),
    'cacheLifetimeSavedUsd', round((select lifetime_hits from cache) * 0.035, 2),
    'stuckSearches', (select stuck from s),
    'failedSearches', (select failed from s),
    'budgetCapped', (select capped from s)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_admin_orgs(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select o.id as org_id, o.name, o.plan,
      (select count(*) from public.organization_members m where m.organization_id = o.id) as users,
      (select count(*) from public.searches s where s.organization_id = o.id and s.created_at >= p_from and s.created_at < p_to and s.status in ('completed','partial')) as searches,
      round(coalesce((select sum(u.quantity * case u.event_type when 'place_search_request' then 0.035 when 'place_details_request' then 0.020 when 'geocode_request' then 0.005 else 0 end)
        from public.usage_events u where u.organization_id = o.id and u.created_at >= p_from and u.created_at < p_to), 0), 2) as est_cost_usd,
      (select max(created_at) from public.searches s where s.organization_id = o.id) as last_activity
    from public.organizations o order by est_cost_usd desc, searches desc
  ) t;
  return result;
end;
$$;
