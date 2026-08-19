-- Fase 3 — Job storage for the async enrichment pipeline (spec #13–15, #17, #74).
--
-- Makes the "fila" observable and retryable. The transport today is
-- functions.invoke chaining (ADR-001: no Redis/BullMQ yet); this table is the
-- shared store every transport reads/writes, and BullMQ remains a future
-- implementation behind the JobQueue interface.
--
-- Tenant-scoped: every job carries organization_id; workers must validate the
-- tenant context (spec #92–93). Dead-letter = `status='failed'` with
-- `attempt >= max_attempts` (see packages/domain/src/job.ts).

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in (
    'COMPANY_DISCOVERY',
    'COMPANY_NORMALIZATION',
    'COMPANY_DEDUPLICATION',
    'BUSINESS_DATA_ENRICHMENT',
    'DIGITAL_PRESENCE_ANALYSIS',
    'CONTACT_ENRICHMENT',
    'WHATSAPP_VALIDATION',
    'REPUTATION_ANALYSIS',
    'OPPORTUNITY_SCORING',
    'TERRITORY_ANALYSIS',
    'NEXT_BEST_ACTION'
  )),
  search_id uuid references public.searches(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','processing','completed','partially_completed','failed','retrying','cancelled')),
  attempt integer not null default 0,
  priority integer not null default 0,
  payload jsonb,
  result jsonb,
  error text,
  idempotency_key text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_jobs_org_status on public.jobs (organization_id, status, created_at);
create index idx_jobs_search on public.jobs (search_id);
create index idx_jobs_place on public.jobs (place_id);
create index idx_jobs_idempotency on public.jobs (organization_id, idempotency_key)
  where idempotency_key is not null;

create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jobs' and policyname = 'jobs_org_read'
  ) then
    create policy jobs_org_read on public.jobs
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;
