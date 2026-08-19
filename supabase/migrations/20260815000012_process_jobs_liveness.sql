-- ============================================================================
-- FASE 2 — JOB LIVENESS / ENRICHMENT RELIABILITY (P0-3)
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores.
--
-- 2.1 — WAKE-UP DO WORKER (o P0)
--   Nada acordava o worker por agenda: os únicos wakes eram fireAndForget em
--   enqueue (execute-search / import-search-results). O sweeper
--   recover_stuck_jobs() devolve jobs de 'retrying' para 'queued' a cada 5 min,
--   mas NÃO acorda o worker — job volta para a fila e fica lá até o próximo
--   enqueue. Aqui o pg_cron chama a edge function process-jobs a cada 2 min via
--   pg_net, copiando o padrão de 20260723000015_recover_stuck_searches_cron.sql.
--   Intervalo */2: o sweeper é */5; 2 min dá latência aceitável sem multiplicar
--   invocação, e a sobreposição de dois workers é segura pelo claim atômico
--   (UPDATE com guarda .eq("status","queued") — o perdedor não recebe linha).
--
--   SECRETS NECESSÁRIOS NO VAULT (uma vez, SQL editor do dashboard):
--     select vault.create_secret('<PROJECT_URL>',      'project_url');
--     select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   Enquanto os secrets não existirem, o cron roda mas o http_post é no-op
--   (o WHERE não encontra os secrets) — ACEITÁVEL e esperado: zero risco
--   aplicar esta migration sem secrets. A service_role key NÃO fica em nenhum
--   arquivo do repo — só referência ao Vault. O header
--   `Authorization: Bearer <service_role_key>` deste padrão JÁ satisfaz
--   isInternalCall do process-jobs (_shared/internal-auth.ts) — nenhum
--   mecanismo de auth novo.
--
-- 2.3 — searches.enriched_count (métrica morta)
--   enriched_count era LIDO (get-search-status e o painel) e NUNCA escrito.
--   Em vez de contador (inflaria em reprocessamento), a contagem passa a ser
--   DERIVADA por COUNT da fonte da verdade (places.enriched_at +
--   enrichment_state) — idempotente por construção: reprocessar o mesmo place
--   recomputa o mesmo número. A função abaixo é chamada por
--   enrich-company.ts logo após o patch de enrichment do place e cobre todas
--   as buscas que contêm aquele place (place pode aparecer em várias buscas).
--   Conta apenas state 'enriched'/'partial' (>= 1 campo de contato encontrado)
--   — 'failed'/'pending' não são contatos encontrados.
--
-- 2.4 — get_job_queue_health() (observabilidade de fila travada)
--   Antes não existia forma de detectar fila travada. Retorna: oldest_queued_at,
--   queued_count, processing_count, retrying_count, failed_count, stuck_count
--   (processing há mais de 10 min — MESMO limiar do sweeper) e
--   oldest_queued_age_seconds. ACL deny-by-default (Fase 1): revoke de
--   public/anon/authenticated + grant só para service_role — a UI de admin lê
--   via edge function com service_role, NUNCA direto do browser.
--   Gate: is_platform_admin() é defesa em profundidade; o bypass para
--   service_role usa request.jwt.claims (GUC setado pelo PostgREST a partir
--   do JWT verificado — NÃO forjável pelo cliente; o GUC por-claim
--   request.jwt.claim.role NÃO é setado em todas as versões do PostgREST,
--   então lemos o JSON completo). NOTA: `current_user` DENTRO de uma função
--   SECURITY DEFINER é o owner (postgres), não o role do JWT — por isso o
--   gate usa o GUC, não current_user. auth.uid() é NULL sob service_role,
--   então o gate puro mataria o único chamador permitido (authenticated nem
--   executa mais — revogado).
-- ============================================================================

-- ── 2.1 wake-up por pg_cron ─────────────────────────────────────────────────
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'process-jobs-wake') then
      perform cron.unschedule('process-jobs-wake');
    end if;
    perform cron.schedule(
      'process-jobs-wake',
      '*/2 * * * *',
      $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/process-jobs',
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
    raise notice 'pg_cron ausente — process-jobs-wake NÃO agendado.';
  end if;
end $$;

-- ── 2.3 enriched_count derivado (idempotente por construção) ────────────────
create or replace function public.recount_search_enriched_counts(p_place_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.searches s
  set enriched_count = sub.cnt
  from (
    select sr.search_id,
           count(*) filter (
             where p.enriched_at is not null
               and p.enrichment_state in ('enriched', 'partial')
           ) as cnt
    from public.search_results sr
    join public.places p on p.id = sr.place_id
    where sr.search_id in (
      select sr2.search_id
      from public.search_results sr2
      where sr2.place_id = p_place_id
    )
    group by sr.search_id
  ) sub
  where s.id = sub.search_id;
$$;

revoke execute on function public.recount_search_enriched_counts(uuid) from anon, authenticated, public;
grant execute on function public.recount_search_enriched_counts(uuid) to service_role;

-- ── 2.4 métrica de liveness da fila ─────────────────────────────────────────
create or replace function public.get_job_queue_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Gate de admin (defesa em profundidade) + bypass para service_role via o
  -- role do JWT verificado (request.jwt.claims é setado pelo PostgREST — NÃO
  -- forjável pelo cliente). current_user dentro de SECURITY DEFINER é o owner
  -- (postgres), por isso NÃO usamos current_user aqui. service_role é o
  -- ÚNICO chamador permitido pelo ACL abaixo.
  if not public.is_platform_admin()
     and coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'oldest_queued_at', min(created_at) filter (where status = 'queued'),
    'queued_count', count(*) filter (where status = 'queued'),
    'processing_count', count(*) filter (where status = 'processing'),
    'retrying_count', count(*) filter (where status = 'retrying'),
    'failed_count', count(*) filter (where status = 'failed'),
    -- MESMO limiar do sweeper recover_stuck_jobs (10 min em processing).
    'stuck_count', count(*) filter (
      where status = 'processing' and started_at < now() - interval '10 minutes'
    ),
    'oldest_queued_age_seconds', coalesce(
      extract(epoch from (now() - min(created_at) filter (where status = 'queued')))
    , 0)::integer
  )
  into result
  from public.jobs;

  return result;
end;
$$;

revoke execute on function public.get_job_queue_health() from anon, authenticated, public;
grant execute on function public.get_job_queue_health() to service_role;
