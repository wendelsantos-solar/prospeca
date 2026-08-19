-- Fase 1 — Job queue claims (spec #13–15, #20): transporte concreto sobre a
-- tabela `jobs`. O domínio (packages/domain/src/job-queue.ts) define a
-- interface JobQueue; esta migration dá o suporte de banco para a implementação
-- em supabase/functions/_shared/job-queue.ts (createSupabaseJobQueue).
--
--  - worker_id     : quem reivindicou o job (claim) — debug/observabilidade.
--  - not_before    : visibilidade do job para claim (backoff de retry). NULL =
--                    claimável imediatamente (retrocompat com linhas antigas).
--  - índice UNIQUE parcial (organization_id, idempotency_key): dedupe real de
--    enqueue — substitui o índice NÃO-único criado em 20260813000002.
--  - índice de claim: ordem canônica de varredura do worker.

alter table public.jobs
  add column if not exists worker_id text,
  add column if not exists not_before timestamptz;

-- Linhas antigas podem conter chaves duplicadas (enrich interativo gravava o
-- mesmo companyProcessingKey em passes diferentes). Mantém a mais recente
-- antes de apertar a unicidade — migration roda uma vez, é determinística.
delete from public.jobs a
using public.jobs b
where a.idempotency_key is not null
  and a.organization_id = b.organization_id
  and a.idempotency_key = b.idempotency_key
  and a.created_at < b.created_at;

drop index if exists public.idx_jobs_idempotency;
create unique index if not exists idx_jobs_idempotency_unique
  on public.jobs (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_jobs_claim
  on public.jobs (status, not_before, priority, created_at);
