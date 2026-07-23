-- V2 (LGPD retenção/minimização): expurga PII de contato raspada de places
-- DESCOBERTOS que nunca viraram lead, após 90 dias. Places convertidos (ligados a
-- um lead no funil) são mantidos — base legal de relacionamento. Só limpa os
-- campos de enrichment; não apaga o place (histórico de busca permanece).
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
         enrichment_status = null
   where p.enriched_at is not null
     and p.enriched_at < now() - interval '90 days'
     and not exists (select 1 from public.leads l where l.place_id = p.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Agenda diária 03:00 UTC. Requer pg_cron (Supabase: Database → Extensions).
-- Envolvido em DO/condicional para a migration aplicar mesmo sem pg_cron ainda:
-- a função fica criada e é só reexecutar o agendamento quando a extensão existir.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-stale-discovery-pii') then
      perform cron.unschedule('purge-stale-discovery-pii');
    end if;
    perform cron.schedule(
      'purge-stale-discovery-pii',
      '0 3 * * *',
      'select public.purge_stale_discovery_pii();'
    );
  else
    raise notice 'pg_cron ausente — purge_stale_discovery_pii() criada mas NÃO agendada. Habilite pg_cron e reexecute o agendamento.';
  end if;
end $$;
