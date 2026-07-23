-- Habilita pg_cron e ativa o job de retenção (V2). pg_cron é preloaded no
-- Supabase; create extension o instala no schema cron.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-stale-discovery-pii') then
    perform cron.unschedule('purge-stale-discovery-pii');
  end if;
  perform cron.schedule(
    'purge-stale-discovery-pii',
    '0 3 * * *',
    'select public.purge_stale_discovery_pii();'
  );
end $$;
