-- Custo estimado deve contar SÓ eventos Google. A era OSM logava usage_events
-- com event_type place_search_request/geocode_request mas provider overpass/
-- nominatim (que eram GRÁTIS). Os RPCs contavam por event_type sem filtrar
-- provider -> inflavam o "custo Google". Filtro por provider like 'google%'.

create or replace function public.org_mtd_api_cost_usd(p_organization_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    u.quantity * case u.event_type
      when 'place_search_request' then 0.035
      when 'place_details_request' then 0.020
      when 'geocode_request' then 0.005 else 0 end
  ), 0)::numeric
  from public.usage_events u
  where u.organization_id = p_organization_id
    and coalesce(u.provider, '') like 'google%'
    and u.created_at >= date_trunc('month', now());
$$;

create or replace function public.get_usage_summary(
  p_organization_id uuid,
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
) returns jsonb language sql stable security definer set search_path = public as $$
  with ev as (
    select event_type, sum(quantity) as q from public.usage_events
    where organization_id = p_organization_id and created_at >= p_from and created_at < p_to
      and coalesce(provider, '') like 'google%'
    group by event_type
  ),
  s as (
    select count(*) filter (where status in ('completed','partial')) as total,
      count(*) filter (where status in ('completed','partial') and provider_request_count = 0) as cache_hits
    from public.searches where organization_id = p_organization_id and created_at >= p_from and created_at < p_to
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'searches', (select total from s),
    'cacheHits', (select cache_hits from s),
    'hitRate', case when (select total from s) > 0 then round((select cache_hits from s)::numeric / (select total from s), 3) else 0 end,
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

create or replace function public.get_admin_overview(
  p_from timestamptz default date_trunc('month', now()),
  p_to timestamptz default now()
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with ev as (
    select event_type, sum(quantity) as q from public.usage_events
    where created_at >= p_from and created_at < p_to and coalesce(provider, '') like 'google%'
    group by event_type
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
  cache as (select count(*) as entries, coalesce(sum(hit_count), 0) as lifetime_hits from public.provider_search_cache where provider = 'google_places')
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
    select o.id as org_id, o.name, o.plan, o.monthly_api_budget_usd as budget_usd,
      (select count(*) from public.organization_members m where m.organization_id = o.id) as users,
      (select count(*) from public.searches s where s.organization_id = o.id and s.created_at >= p_from and s.created_at < p_to and s.status in ('completed','partial')) as searches,
      round(coalesce((select sum(u.quantity * case u.event_type when 'place_search_request' then 0.035 when 'place_details_request' then 0.020 when 'geocode_request' then 0.005 else 0 end)
        from public.usage_events u where u.organization_id = o.id and u.created_at >= p_from and u.created_at < p_to and coalesce(u.provider,'') like 'google%'), 0), 2) as est_cost_usd,
      (select max(created_at) from public.searches s where s.organization_id = o.id) as last_activity
    from public.organizations o order by est_cost_usd desc, searches desc
  ) t;
  return result;
end;
$$;

create or replace function public.get_admin_timeseries(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb) into result from (
    select d::date as day,
      (select count(*) from public.searches s where s.created_at >= d and s.created_at < d + interval '1 day' and s.status in ('completed','partial')) as searches,
      round(coalesce((select sum(u.quantity * case u.event_type when 'place_search_request' then 0.035 when 'place_details_request' then 0.020 when 'geocode_request' then 0.005 else 0 end)
        from public.usage_events u where u.created_at >= d and u.created_at < d + interval '1 day' and coalesce(u.provider,'') like 'google%'), 0), 2) as est_cost_usd
    from generate_series(date_trunc('day', now()) - ((p_days - 1) || ' days')::interval, date_trunc('day', now()), interval '1 day') d
  ) t;
  return result;
end;
$$;
