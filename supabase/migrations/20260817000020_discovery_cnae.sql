-- FASE 5 — CNAE ACIONÁVEL: o dado já era coletado (lookup-cnpj → places.primary_cnae,
-- cnae_description, secondary_cnaes) e nunca chegava ao cliente. Sem ele na
-- descoberta, não há como buscar nem filtrar por atividade econômica — dado pago
-- que não virava produto.
--
-- DROP + CREATE, não CREATE OR REPLACE: acrescentar colunas ao RETURNS TABLE muda
-- o tipo de retorno, e o Postgres recusa a substituição. O DROP e o CREATE ficam na
-- MESMA transação da migration, então não há janela sem a função.
--
-- ATENÇÃO — esta é a função que teve o P0-1 (leitura de PII cross-tenant por
-- p_organization_id usado como prova de membership). A recriação abaixo preserva
-- LITERALMENTE a autorização por is_organization_member e o ACL endurecido. Se
-- alguém reescrever isto, o membership check NÃO é opcional.
drop function if exists public.get_search_discovery(uuid, uuid);

create function public.get_search_discovery(
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
  enrichment_fields jsonb,
  primary_cnae text,
  cnae_description text,
  secondary_cnaes text[]
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
    p.enrichment_fields,
    p.primary_cnae,
    p.cnae_description,
    p.secondary_cnaes
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  where sr.search_id = p_search_id
    -- Autorização: SEMPRE pelo membership do JWT (auth.uid()). NÃO reintroduzir
    -- o "fast path" por p_organization_id — era o vetor do P0-1.
    and public.is_organization_member(s.organization_id)
    -- p_organization_id é filtro opcional: só REMOVE linhas, nunca concede acesso.
    and (p_organization_id is null or s.organization_id = p_organization_id)
  order by sr.score desc nulls last, sr.distance_meters asc nulls last;
$$;

-- ACL: o DROP levou os grants junto. Restaura o estado endurecido da Fase 1.
revoke all on function public.get_search_discovery(uuid, uuid) from public, anon;
grant execute on function public.get_search_discovery(uuid, uuid) to authenticated;

-- Índice para o filtro por atividade econômica sobre a carteira/descoberta.
create index if not exists idx_places_primary_cnae on public.places (primary_cnae)
  where primary_cnae is not null;
