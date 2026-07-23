-- Google-only cache Nivel 2 (Fase 3): spatial coverage reuse. A cached search
-- whose circle fully contains the requested circle can serve it (payload then
-- haversine-filtered to the smaller circle) without an exact cache_key match.
alter table public.provider_search_cache
  add column if not exists category text,
  add column if not exists center geography(Point, 4326),
  add column if not exists radius_meters integer;

-- GiST spatial index for the containment lookup.
create index if not exists idx_provider_cache_center
  on public.provider_search_cache using gist (center);

-- Smallest cached circle (same category, still fresh) that fully contains the
-- requested circle. Containment on the sphere: dist(centers) + reqRadius <=
-- cachedRadius. ST_Distance on geography returns meters.
create or replace function public.find_covering_cache(
  p_category text,
  p_lng double precision,
  p_lat double precision,
  p_radius integer
) returns table (payload jsonb, radius_meters integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.payload, c.radius_meters
  from public.provider_search_cache c
  where c.category = p_category
    and c.expires_at > now()
    and c.center is not null
    and c.radius_meters is not null
    and st_distance(
          c.center,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
        ) + p_radius <= c.radius_meters
  order by c.radius_meters asc
  limit 1;
$$;

-- Edge Functions call this via service role; no client access.
revoke all on function public.find_covering_cache(text, double precision, double precision, integer)
  from public, anon, authenticated;
grant execute on function public.find_covering_cache(text, double precision, double precision, integer)
  to service_role;
