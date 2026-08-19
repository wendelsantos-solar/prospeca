-- Fase 4 — territory_stats: agregados territoriais server-side (spec #37–41).
--
-- Uma linha por (org, search, group_by, key). group_by é o agrupamento EFETIVO
-- (neighborhood quando alguma empresa tem bairro, city caso contrário — regra
-- pura resolveTerritoryGroupBy em packages/domain/src/territory.ts); a
-- territory-analysis remove linhas do search com group_by diferente antes do
-- upsert, então existe uma única série por busca.
--
-- Escrita exclusiva via service role (territory-analysis); leitura sob RLS da org.

create table public.territory_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  search_id uuid not null references public.searches(id) on delete cascade,
  group_by text not null check (group_by in ('neighborhood','city')),
  key text not null,
  company_count integer not null,
  hot_count integer not null default 0,
  avg_score integer not null default 0,
  without_website_ratio numeric not null default 0,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  calculated_at timestamptz not null default now(),
  unique (organization_id, search_id, group_by, key)
);

create index idx_territory_stats_org_search
  on public.territory_stats (organization_id, search_id);

alter table public.territory_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'territory_stats'
      and policyname = 'territory_stats_org_read'
  ) then
    create policy territory_stats_org_read on public.territory_stats
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;
