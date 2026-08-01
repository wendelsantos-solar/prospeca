-- Fase B: error_events tinha zero consumidor — nada nunca lia a tabela, nem
-- o painel de admin. A cada 30 min chama a edge function error-digest, que
-- agrupa e emaila erros novos (severity='error') para ADMIN_ALERT_EMAIL.
-- Mesmo padrão de recover-stuck-searches: reusa os secrets já no Vault
-- (project_url, service_role_key) — nada novo a configurar no banco.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'error-digest') then
      perform cron.unschedule('error-digest');
    end if;
    perform cron.schedule(
      'error-digest',
      '*/30 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/error-digest',
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
    raise notice 'pg_cron ausente — error-digest NÃO agendado.';
  end if;
end $$;
