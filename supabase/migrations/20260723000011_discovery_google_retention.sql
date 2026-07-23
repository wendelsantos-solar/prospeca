-- Retenção por classe (Fase 5 / D6 / §7) — conformidade ToS Google Places.
-- Google caps o cache de campos NÃO-place_id (nome, telefone, rating, endereço,
-- horário) em <=30 dias. Places puramente de DESCOBERTA (sem lead no funil) que
-- passaram de 30d têm o conteúdo Google expurgado, mantendo só provider_place_id
-- (place_id é o único campo que a ToS permite guardar indefinidamente).
--
-- Places convertidos (ligados a um lead) NÃO são tocados aqui: o funil renova os
-- campos Google em cadência <=30d via refresh-place-details (base de
-- relacionamento). Complementa purge_stale_discovery_pii() (enrichment/LGPD a
-- 90d), que cuida de email/instagram/whatsapp — bases legais distintas.
create or replace function public.purge_stale_discovery_google_content()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.places p
     set name = '',
         primary_type = null,
         types = '[]'::jsonb,
         formatted_address = null,
         location = null,
         national_phone_number = null,
         international_phone_number = null,
         website_uri = null,
         google_maps_uri = null,
         business_status = null,
         rating = null,
         user_rating_count = null,
         price_level = null,
         opening_hours = null,
         address_components = null,
         provider_payload = null,
         provider_fetched_at = null,
         provider_refresh_after = null
   where p.provider = 'google_places'
     and p.provider_fetched_at is not null
     and p.provider_fetched_at < now() - interval '30 days'
     and not exists (select 1 from public.leads l where l.place_id = p.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Agenda diária 03:15 UTC (offset do purge de PII às 03:00). pg_cron já
-- habilitado em 20260723000007; condicional para aplicar mesmo sem a extensão.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-stale-discovery-google-content') then
      perform cron.unschedule('purge-stale-discovery-google-content');
    end if;
    perform cron.schedule(
      'purge-stale-discovery-google-content',
      '15 3 * * *',
      'select public.purge_stale_discovery_google_content();'
    );
  else
    raise notice 'pg_cron ausente — purge_stale_discovery_google_content() criada mas NÃO agendada.';
  end if;
end $$;
