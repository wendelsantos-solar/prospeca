-- Surface enrichment contact fields (email/instagram/whatsapp) in discovery, so
-- the map/list/preview/CSV can show them once enrich-discovery fills them.
--
-- Optimized: accepts organization_id so the caller proves membership once
-- (via x-organization-id header + RLS on searches) instead of the RPC
-- re-checking is_organization_member() on every invocation. The p_search_id
-- overload (no org) still works for backward compat with the old call path.
drop function if exists public.get_search_discovery(uuid);
drop function if exists public.get_search_discovery(uuid, uuid);

create or replace function public.get_search_discovery(p_search_id uuid, p_organization_id uuid default null)
returns table (
  place_id uuid,
  name text,
  category text,
  latitude double precision,
  longitude double precision,
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
  imported_lead_id uuid
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
    sr.imported_lead_id
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  where sr.search_id = p_search_id
    and (
      -- Fast path: caller passes the org id directly, no subquery needed.
      p_organization_id is not null and s.organization_id = p_organization_id
      -- Slow path (backward compat): derive org membership via subquery.
      or (p_organization_id is null and public.is_organization_member(s.organization_id))
    )
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;
