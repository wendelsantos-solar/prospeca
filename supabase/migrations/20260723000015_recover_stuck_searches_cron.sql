-- Fase A: sweeper de buscas presas. A cada 2 min chama a edge function
-- recover-stuck-searches, que re-dispara execute-search para buscas travadas.
--
-- pg_net faz o HTTP a partir do banco. A service_role key + URL do projeto NÃO
-- vão no git — ficam no Vault. ATIVE rodando UMA VEZ (SQL editor do dashboard):
--   select vault.create_secret('<PROJECT_URL>',     'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>','service_role_key');
-- Enquanto os secrets não existirem, o cron roda mas o http_post é no-op
-- (o WHERE não encontra os secrets). Zero risco aplicar sem eles.
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'recover-stuck-searches') then
      perform cron.unschedule('recover-stuck-searches');
    end if;
    perform cron.schedule(
      'recover-stuck-searches',
      '*/2 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/recover-stuck-searches',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization',
          'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      )
      where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
        and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
      $cron$
    );
  else
    raise notice 'pg_cron ausente — recover-stuck-searches NÃO agendado.';
  end if;
end $$;
