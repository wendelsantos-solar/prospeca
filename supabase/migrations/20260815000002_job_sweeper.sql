-- Fase 1 — Job sweeper (spec #74): destrava jobs órfãos e vence backoffs.
--
-- Diferente do recover-stuck-searches (que chama uma edge function via pg_net),
-- aqui o trabalho é SQL puro e roda direto no cron — sem dependência de Vault.
--
--  - `processing` com started_at > 10min = worker/handler morreu no meio →
--    `retrying` com not_before = agora; o segundo UPDATE flipa imediatamente
--    para `queued`. (processing→retrying→queued respeita a máquina de estados
--    do domínio — processing→queued NÃO é transição válida em
--    packages/domain/src/job.ts.)
--    EXCEÇÃO: `processing` com attempt >= max → `failed` (dead-letter): um
--    job que estourou as tentativas não deve loopar para sempre.
--  - `retrying` com not_before vencido → `queued` (backoff terminou).
--
-- Requeue manual do admin (retry-job) deixa o job `queued` (nunca `processing`),
-- então NÃO é afetado pela regra de dead-letter — roda de novo normalmente.
-- attempt >= 3 = DEFAULT_MAX_ATTEMPTS de packages/domain/src/job.ts (manter sincronizado).

create or replace function public.recover_stuck_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_now timestamptz := now();
begin
  update public.jobs
     set status = 'failed',
         finished_at = v_now,
         error = coalesce(error, 'dead letter: attempts esgotados (sweeper)')
   where status = 'processing'
     and started_at is not null
     and started_at < v_now - interval '10 minutes'
     and attempt >= 3;

  update public.jobs
     set status = 'retrying',
         not_before = v_now
   where status = 'processing'
     and started_at is not null
     and started_at < v_now - interval '10 minutes'
     and attempt < 3;

  update public.jobs
     set status = 'queued',
         not_before = null
   where status = 'retrying'
     and not_before <= v_now;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'recover-stuck-jobs') then
      perform cron.unschedule('recover-stuck-jobs');
    end if;
    perform cron.schedule(
      'recover-stuck-jobs',
      '*/5 * * * *',
      $cron$ select public.recover_stuck_jobs(); $cron$
    );
  else
    raise notice 'pg_cron ausente — recover-stuck-jobs NÃO agendado.';
  end if;
end $$;
