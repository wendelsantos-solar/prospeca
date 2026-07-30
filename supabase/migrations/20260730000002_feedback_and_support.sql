-- Radar Local — feedback, support requests, and product analytics events

-- Feedback and support table
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('feedback', 'bug', 'question', 'feature_request', 'data_quality')),
  category text,
  message text not null,
  current_page text,
  app_version text,
  browser text,
  operating_system text,
  request_id text,
  screenshot_url text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'in_progress', 'resolved', 'closed')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_feedback_org on public.feedback (organization_id, created_at desc);
create index idx_feedback_status on public.feedback (status) where status = 'open';
create trigger trg_feedback_updated before update on public.feedback
  for each row execute function public.set_updated_at();

-- RLS
alter table public.feedback enable row level security;

-- Members can see their org's feedback
create policy feedback_select on public.feedback for select
  using (public.is_organization_member(organization_id));

-- Members can create feedback
create policy feedback_insert on public.feedback for insert
  with check (public.is_organization_member(organization_id) and user_id = auth.uid());

-- Only owner/admin can update status (internal)
create policy feedback_update on public.feedback for update
  using (public.has_organization_role(organization_id, array['owner','admin']));

-- Product analytics events (extending usage_events for product events)
-- usage_events already exists; this adds a view for easier product analytics queries.
-- Product events use the 'metric' column (added in billing_foundation migration)
-- while API cost events use 'event_type'. Both coexist in the same table.

create or replace view public.product_events as
select
  id,
  organization_id,
  user_id,
  metric as event_name,
  quantity,
  source_type,
  source_id,
  idempotency_key,
  created_at
from public.usage_events
where metric is not null;

-- Pilot plan — adiciona o plano "pilot" ao catálogo de planos.
-- Só insere se não existir (idempotente).
insert into public.billing_plans
  (code, name, description, monthly_price_cents, annual_price_cents, features, limits, display_order, is_public)
select
  'pilot', 'Pilot', 'Plano exclusivo para beta privado — acesso antecipado.', 0, 0,
  '{"lead_search":true,"advanced_filters":true,"pipeline":true,"saved_searches":true,"search_monitoring":true,"csv_export":true,"xlsx_export":false,"message_templates":true,"cadences":false,"automations":false,"advanced_analytics":true,"team_management":false,"custom_permissions":false,"api_access":false}',
  '{"users":1,"searchesPerMonth":60,"processedLeadsPerMonth":1000,"savedSearches":20,"activeMonitors":5,"pipelines":1,"messageTemplates":20,"exportRowsPerMonth":3000}',
  10, false
where not exists (select 1 from public.billing_plans where code = 'pilot');

-- Pilot-specific fields on organizations
alter table public.organizations
  add column if not exists pilot_started_at timestamptz,
  add column if not exists pilot_ends_at timestamptz,
  add column if not exists pilot_status text
    check (pilot_status in ('invited','onboarding','active','inactive','completed','converted','declined','expired')),
  add column if not exists pilot_notes text,
  add column if not exists pilot_source text;
