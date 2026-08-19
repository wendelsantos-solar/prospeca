-- FASE 15 — DECISOR ACIONÁVEL NA TRIAGEM: o decisor já era resolvido e
-- classificado (company_people), mas só aparecia abrindo empresa por empresa.
-- Sem ele na descoberta não há como PRIORIZAR uma lista de 60 resultados —
-- o dado existia e não virava decisão.
--
-- DROP + CREATE, não CREATE OR REPLACE: acrescentar colunas ao RETURNS TABLE
-- muda o tipo de retorno e o Postgres recusa a substituição. DROP e CREATE na
-- MESMA transação — não há janela sem a função.
--
-- ATENÇÃO — esta é a função que teve o P0-1 (leitura de PII cross-tenant por
-- p_organization_id usado como prova de membership). A recriação abaixo
-- preserva LITERALMENTE a autorização por is_organization_member e o ACL
-- endurecido. Se alguém reescrever isto, o membership check NÃO é opcional.
--
-- MINIMIZAÇÃO DE DADOS: a lista devolve CONTAGEM, BANDA e SCORE do decisor —
-- nunca o NOME. Para triar 60 empresas o vendedor precisa saber onde há um
-- decisor forte, não quem ele é; o nome aparece ao abrir a empresa, sob a mesma
-- RLS. Assim o PII de sócio não trafega em payload de listagem.
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
  secondary_cnaes text[],
  decision_maker_count integer,
  top_decision_maker_band text,
  top_decision_maker_score integer
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
    p.secondary_cnaes,
    coalesce(dm.total, 0)::integer as decision_maker_count,
    dm.top_band as top_decision_maker_band,
    dm.top_score::integer as top_decision_maker_score
  from public.search_results sr
  join public.places p on p.id = sr.place_id
  join public.searches s on s.id = sr.search_id
  -- Agregado por empresa. Só relações VIGENTES e só bandas que sustentam uma
  -- indicação (high/medium) — o mesmo recorte de pickPrimaryDecisionMaker no
  -- domínio. Contar um estagiário como "decisor identificado" mandaria o
  -- vendedor priorizar a empresa errada.
  left join lateral (
    select
      count(*) as total,
      (array_agg(cp.role_band order by cp.decision_score desc nulls last))[1] as top_band,
      max(cp.decision_score) as top_score
    from public.company_people cp
    where cp.place_id = p.id
      and cp.organization_id = s.organization_id
      and cp.is_current
      and cp.role_band in ('high', 'medium')
  ) dm on true
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
