-- Discovery preview still showed "Não encontrado" for Cidade when the place
-- itself has no formatted_address/address_components. The search that found
-- it already carries a location (the label the user searched from,
-- `searches.location_label`) — surface it so the frontend can fall back to
-- it instead of leaving Cidade empty.
-- Return type changes → drop before recreate.
drop function if exists public.get_search_discovery(uuid);
create or replace function public.get_search_discovery(p_search_id uuid)
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
    sr.imported_lead_id
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  where sr.search_id = p_search_id
    and public.is_organization_member(s.organization_id)
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;
