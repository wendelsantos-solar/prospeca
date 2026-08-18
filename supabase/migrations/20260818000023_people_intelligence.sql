-- People Intelligence — pessoas relacionadas a empresas (D4: modelo HÍBRIDO).
--
-- `places.qsa` CONTINUA sendo o snapshot bruto da fonte. Estas tabelas
-- materializam a relação normalizada derivada dele, para que:
--   • a mesma pessoa possa se relacionar a VÁRIAS empresas (brief §23);
--   • fontes futuras (site, redes profissionais) alimentem o MESMO modelo com
--     seu próprio `source`/`confidence` (brief §24, §41), sem nova tabela;
--   • reprocessar a classificação de decisor não gaste consulta na fonte.
--
-- TENANCY: tenant-scoped (organization_id), igual a `places` e
-- `company_sources` — decisão D2 vigente. Uma Person é reutilizável entre
-- empresas DENTRO da organização; nada atravessa tenant.
--
-- ESCRITA: exclusivamente service role (edge functions). Nenhuma policy de
-- INSERT/UPDATE/DELETE — mesmo padrão de jobs / company_sources.
--
-- PII E RETENÇÃO: `people.full_name` é dado pessoal (nome de sócio, público no
-- QSA). Fica sob EXATAMENTE a mesma política do QSA bruto — 90 dias a partir
-- de registration_fetched_at, apenas em places NUNCA convertidos em lead. O
-- expurgo é estendido no fim desta migration, na mesma transação em que as
-- tabelas nascem: nenhuma janela em que a PII exista sem expurgo.

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  -- Nome normalizado (packages/domain/src/person.ts :: normalizePersonName).
  normalized_name text not null,
  -- Sem CPF (descartado por política), o nome é o único identificador — e é
  -- FRACO. O método e a confiança da IDENTIDADE ficam explícitos aqui, e são
  -- coisa diferente da confiança da RELAÇÃO (em company_people).
  identity_method text not null default 'name_exact'
    check (identity_method in ('name_exact')),
  identity_confidence numeric not null default 0.6
    check (identity_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência da resolução: reprocessar o mesmo QSA não duplica pessoa.
create unique index if not exists uq_people_org_normalized_name
  on public.people (organization_id, normalized_name);

create table if not exists public.company_people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  -- Qualificação como a fonte a escreve, e o código RFB (estável).
  role text,
  role_code text,
  -- Banda de decisão (Fase 5). Preenchida pelo classificador determinístico.
  role_band text check (role_band in ('high', 'medium', 'low', 'unknown')),
  decision_score integer check (decision_score between 0 and 100),
  -- Motivos legíveis do score — o brief §27 proíbe score opaco.
  decision_reasons jsonb,
  member_type text not null default 'unknown'
    check (member_type in ('company', 'person', 'foreign', 'unknown')),
  source text not null check (source in ('qsa')),
  source_provider text not null default 'business_registry',
  -- Confiança de que a RELAÇÃO existe. QSA é registro oficial → 1.
  confidence numeric not null default 1 check (confidence between 0 and 1),
  started_at date,
  ended_at date,
  is_current boolean not null default true,
  -- Quando o sócio é PJ, quem exerce o papel é o representante legal.
  legal_representative_name text,
  legal_representative_role text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotência da relação: o mesmo (empresa, pessoa, fonte) é UMA linha,
-- reconsultas fazem upsert. Protege contra requests concorrentes e retries.
create unique index if not exists uq_company_people_place_person_source
  on public.company_people (organization_id, place_id, person_id, source);

create index if not exists idx_company_people_place
  on public.company_people (place_id, is_current);
create index if not exists idx_company_people_person
  on public.company_people (person_id);
create index if not exists idx_company_people_org_band
  on public.company_people (organization_id, role_band);

-- Guardados para casar com o resto da migration, que é toda idempotente.
drop trigger if exists trg_people_updated on public.people;
create trigger trg_people_updated before update on public.people
  for each row execute function public.set_updated_at();
drop trigger if exists trg_company_people_updated on public.company_people;
create trigger trg_company_people_updated before update on public.company_people
  for each row execute function public.set_updated_at();

alter table public.people enable row level security;
alter table public.company_people enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'people' and policyname = 'people_org_read'
  ) then
    create policy people_org_read on public.people
      for select using (public.is_organization_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'company_people'
      and policyname = 'company_people_org_read'
  ) then
    create policy company_people_org_read on public.company_people
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;

-- ── Expurgo LGPD estendido ──────────────────────────────────────────────────
--
-- A função vigente (20260816000018) anula `qsa` quando
-- registration_fetched_at vence os 90 dias em place NÃO convertido. As pessoas
-- derivadas desse QSA têm que sumir com ele — senão o dado que a política
-- mandou apagar sobrevive numa tabela nova, que é exatamente o vazamento de
-- retenção que a migration anterior fechou.
--
-- Semântica preservada palavra por palavra para o grupo de contato/enrichment
-- e para o grupo de registro; o único acréscimo é a remoção das relações e das
-- pessoas que ficaram órfãs.
--
-- ÓRFÃS: uma Person só é apagada quando NENHUMA relação sobra. Uma pessoa que
-- também é sócia de outra empresa ainda dentro da janela continua existindo —
-- a base legal daquela outra relação segue válida.
create or replace function public.purge_stale_discovery_pii()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- Relações derivadas de um QSA que venceu (mesmo critério do CASE de `qsa`
  -- abaixo: registro com mais de 90 dias em place nunca convertido).
  delete from public.company_people cp
   where exists (
           select 1
             from public.places p
            where p.id = cp.place_id
              and p.registration_fetched_at is not null
              and p.registration_fetched_at < now() - interval '90 days'
              and not exists (select 1 from public.leads l where l.place_id = p.id)
         );

  -- Pessoas que ficaram sem NENHUMA relação. O recorte por `created_at` evita
  -- a corrida com um enrichment em curso (pessoa inserida um instante antes da
  -- sua relação); quem ainda é sócio de outra empresa dentro da janela
  -- permanece, porque aquela base legal continua válida.
  delete from public.people pe
   where pe.created_at < now() - interval '90 days'
     and not exists (
           select 1 from public.company_people cp where cp.person_id = pe.id
         );

  update public.places p
     set
       -- grupo contato/enrichment — regido por enriched_at
       email        = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else email end,
       instagram    = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else instagram end,
       whatsapp     = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else whatsapp end,
       whatsapp_status = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then 'unknown' else whatsapp_status end,
       enriched_at  = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else enriched_at end,
       enrichment_status = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else enrichment_status end,
       enrichment_state = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then 'pending' else enrichment_state end,
       enrichment_fields = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then '{}'::jsonb else enrichment_fields end,
       -- grupo registro (QSA + contatos de cadastro) — regido por
       -- registration_fetched_at
       qsa          = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else qsa end,
       registry_email = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else registry_email end,
       registry_phone = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else registry_phone end
   where not exists (select 1 from public.leads l where l.place_id = p.id)
     and (
       (p.enriched_at is not null and p.enriched_at < now() - interval '90 days')
       or
       (p.registration_fetched_at is not null
        and p.registration_fetched_at < now() - interval '90 days')
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.purge_stale_discovery_pii() from anon, authenticated, public;
grant execute on function public.purge_stale_discovery_pii() to service_role;
