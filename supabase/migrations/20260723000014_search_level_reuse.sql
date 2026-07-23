-- Fase 3 (custo/UX): cache de NÍVEL-BUSCA. O cache de provedor (Nível 1/2) já
-- evita pagar o Google, mas cada busca ainda RE-IMPORTA (dedup+score+upsert de
-- places/search_results ~300-800ms). Quando existe uma busca "gêmea" recente da
-- mesma org (mesmo nicho normalizado, centro <=110m, mesmo raio+presença,
-- concluída, com resultados), copiamos os search_results dela — zero Google,
-- zero re-import, quase instantâneo. Sobe o hit-rate.
create or replace function public.reuse_recent_search_results(
  p_search_id uuid,
  p_max_age interval default interval '30 days'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.searches;
  twin uuid;
  n integer;
begin
  select * into me from public.searches where id = p_search_id;
  if not found then return 0; end if;

  -- Gêmea: mesma org, nicho normalizado igual, centro dentro de 110m, mesmo raio
  -- + presença, concluída dentro da janela, e que tenha resultados.
  select s.id into twin
  from public.searches s
  where s.organization_id = me.organization_id
    and s.id <> me.id
    and s.status in ('completed', 'partial')
    and s.radius_meters = me.radius_meters
    and s.presence_filter = me.presence_filter
    and lower(s.query) = lower(me.query)
    and lower(coalesce(s.category, '')) = lower(coalesce(me.category, ''))
    and s.created_at >= now() - p_max_age
    and me.center is not null
    and ST_DWithin(s.center, me.center, 110)
    and exists (select 1 from public.search_results r where r.search_id = s.id)
  order by s.created_at desc
  limit 1;

  if twin is null then return 0; end if;

  insert into public.search_results
    (search_id, place_id, distance_meters, position, provider_rank,
     matched_query, is_inside_radius, score, temperature, score_breakdown)
  select p_search_id, place_id, distance_meters, position, provider_rank,
     matched_query, is_inside_radius, score, temperature, score_breakdown
  from public.search_results
  where search_id = twin
  on conflict (search_id, place_id) do nothing;
  get diagnostics n = row_count;

  update public.searches
     set status = 'completed',
         provider_request_count = 0,
         found_count = (select count(*) from public.search_results where search_id = p_search_id),
         completed_at = now()
   where id = p_search_id;

  return n;
end;
$$;

revoke all on function public.reuse_recent_search_results(uuid, interval) from public, anon, authenticated;
grant execute on function public.reuse_recent_search_results(uuid, interval) to service_role;
