-- Fase 3 — company_sources: proveniência por empresa (spec #26, #94).
--
-- Registra DE ONDE vieram os dados de cada place e com que confiança. Hoje
-- tenant-scoped (organization_id), seguindo `places` — decisão D2: colunas
-- preparadas para globalizar depois (basta relaxar organization_id quando o
-- licenciamento das fontes permitir), NÃO globalizar agora.
--
-- Escrita exclusiva via service role (edge functions); leitura sob RLS da org.

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  provider text not null,
  provider_external_id text,
  source_type text not null,
  raw_snapshot_ref text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_company_sources_place_provider
  on public.company_sources (place_id, provider);
create index idx_company_sources_org_place
  on public.company_sources (organization_id, place_id);

create trigger trg_company_sources_updated before update on public.company_sources
  for each row execute function public.set_updated_at();

alter table public.company_sources enable row level security;

-- Leitura: membros da organização dona. Escrita: service role only
-- (nenhuma policy de INSERT/UPDATE/DELETE — as edge functions usam a
-- service-role key, mesmo padrão de jobs/company_opportunity_scores).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'company_sources'
      and policyname = 'company_sources_org_read'
  ) then
    create policy company_sources_org_read on public.company_sources
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;
