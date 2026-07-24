-- Discovery preview had no address: `places.formatted_address` /
-- `places.address_components` are stored from Google but never surfaced, so the
-- read-only drawer showed "Não encontrado" for Endereço and Cidade.
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
