-- Fase 6 — Per-organization opportunity score (spec #59–62).
--
-- Separates the org-specific opportunity score from any global company quality:
-- the SAME company can score 92 for a web designer and 64 for an accountant.
-- `place_id` is the canonical company — the domain "Company" maps onto `places`
-- (audit decision: keep `places`, don't duplicate into a parallel `companies`
-- table). The legacy single-formula `leads.score` (v3.0.0) is left untouched.
--
-- Additive. Writes go through Edge Functions using the service role.

create table public.company_opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  search_id uuid references public.searches(id) on delete set null,
  score integer not null check (score between 0 and 100),
  temperature text not null default 'cold' check (temperature in ('hot','warm','cold')),
  rule_version text not null,
  breakdown jsonb,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  calculated_at timestamptz not null default now(),
  -- One score per org/company/version → recalculations replace, never duplicate.
  unique (organization_id, place_id, rule_version)
);

create index idx_co_scores_org on public.company_opportunity_scores (organization_id, score desc);
create index idx_co_scores_place on public.company_opportunity_scores (place_id);
create index idx_co_scores_search on public.company_opportunity_scores (search_id);

alter table public.company_opportunity_scores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_opportunity_scores'
      and policyname = 'co_scores_org_read'
  ) then
    create policy co_scores_org_read on public.company_opportunity_scores
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;
