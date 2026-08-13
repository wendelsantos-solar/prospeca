-- Reconcile get_search_discovery into a single signature + surface enrichment
-- state so the frontend can distinguish "não possui" from "ainda não verificamos".
--
-- History: the RPC was dropped/recreated 4× and ended up with TWO coexisting
-- signatures — get_search_discovery(uuid) and get_search_discovery(uuid, uuid
-- default null) — which makes the one-arg call ambiguous in PostgreSQL. Collapse
-- to the single (uuid, uuid default null) overload the frontend already calls,
-- and add enrichment_state/enrichment_fields to the return type.

drop function if exists public.get_search_discovery(uuid);
drop function if exists public.get_search_discovery(uuid, uuid);

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
    and (
      -- Fast path: caller proves membership by passing the org id directly.
      (p_organization_id is not null and s.organization_id = p_organization_id)
      -- Slow path (backward compat): derive membership via subquery.
      or (p_organization_id is null and public.is_organization_member(s.organization_id))
    )
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;

-- LGPD purge (90d) must also reset the new enrichment state, so purged places
-- read as "pending" rather than "enriched with empty fields".
create or replace function public.purge_stale_discovery_pii()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.places p
     set email = null,
         instagram = null,
         whatsapp = null,
         whatsapp_status = 'unknown',
         enriched_at = null,
         enrichment_status = null,
         enrichment_state = 'pending',
         enrichment_fields = '{}'::jsonb
   where p.enriched_at is not null
     and p.enriched_at < now() - interval '90 days'
     and not exists (select 1 from public.leads l where l.place_id = p.id);
  get diagnostics n = row_count;
  return n;
end;
$$;
