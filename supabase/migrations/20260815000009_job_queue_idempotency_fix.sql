-- Fix 42P10 — índice de idempotência de jobs (Fase 1).
--
-- O índice unique PARCIAL criado em 20260815000001
--   (organization_id, idempotency_key) where idempotency_key is not null
-- não casa com `ON CONFLICT (organization_id, idempotency_key)` usado pelo
-- enqueue (supabase/functions/_shared/job-queue.ts) — PostgreSQL não casa
-- índice parcial com ON CONFLICT por lista de colunas → 42P10 no runtime
-- (encontrado no smoke ponta-a-ponta).
--
-- Fix: índice unique TOTAL. NULLs são distintos em Postgres, então jobs SEM
-- idempotency_key continuam ilimitados — a semântica de dedupe é idêntica.
-- Nenhuma mudança de código TS é necessária.

drop index if exists public.idx_jobs_idempotency;
drop index if exists public.idx_jobs_idempotency_unique;

create unique index idx_jobs_idempotency
  on public.jobs (organization_id, idempotency_key);
