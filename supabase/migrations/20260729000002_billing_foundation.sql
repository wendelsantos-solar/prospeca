-- Billing Fase 1 — fundação: catálogo de planos, assinaturas, uso e créditos.
-- Aditivo: não altera create-search/execute-search nem o quota system atual
-- (get_quota_status / assertSearchQuota continuam gateando buscas exatamente
-- como hoje). Isso só constrói a base pra Fase 2 (Stripe) plugar em cima.
--
-- Convenção de "ilimitado/personalizado" em `limits`: valor -1. Documentado
-- em docs/PLANS_AND_ENTITLEMENTS.md.

create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_public boolean not null default true,
  monthly_price_cents integer,
  annual_price_cents integer,
  currency text not null default 'BRL',
  provider_monthly_price_id text,
  provider_annual_price_id text,
  features jsonb not null default '{}',
  limits jsonb not null default '{}',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_billing_plans_updated before update on public.billing_plans
  for each row execute function public.set_updated_at();

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique not null references public.organizations(id) on delete cascade,
  provider text not null,
  provider_customer_id text unique not null,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_billing_customers_updated before update on public.billing_customers
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid unique not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  provider text,
  provider_subscription_id text unique,
  provider_price_id text,
  status text not null
    check (status in ('free','trialing','active','past_due','unpaid','cancelled','incomplete','expired','paused')),
  billing_interval text check (billing_interval in ('monthly','annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  grace_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  period_start date not null,
  period_end date not null,
  quantity bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, metric, period_start)
);
create index idx_usage_counters_org_period on public.usage_counters (organization_id, period_start desc);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null,
  provider_event_id text unique not null,
  event_type text not null,
  status text not null default 'received',
  payload jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_billing_events_org on public.billing_events (organization_id, created_at desc);

create table public.credit_balances (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  included_credits integer not null default 0,
  purchased_credits integer not null default 0,
  bonus_credits integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger trg_credit_balances_updated before update on public.credit_balances
  for each row execute function public.set_updated_at();

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('grant','purchase','consume','expire','adjustment')),
  quantity integer not null,
  balance_after integer not null,
  description text,
  reference_type text,
  reference_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_credit_tx_org on public.credit_transactions (organization_id, created_at desc);

-- usage_events já existe (20260719000004_ops.sql) com event_type restrito a
-- um enum fixo de custos de API. Estende (não substitui) pra também suportar
-- métricas de entitlement (ex: "processed_leads") que não são custo de
-- provider — por isso event_type vira opcional.
alter table public.usage_events alter column event_type drop not null;
alter table public.usage_events add column metric text;
alter table public.usage_events add column idempotency_key text;
alter table public.usage_events add column source_type text;
alter table public.usage_events add column source_id uuid;
create unique index idx_usage_events_idempotency on public.usage_events (organization_id, idempotency_key)
  where idempotency_key is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.billing_plans enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.billing_events enable row level security;
alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

-- Catálogo de preço não é sensível — pricing page pública pra qualquer
-- usuário autenticado. Sem policy de insert/update: só service role escreve.
create policy billing_plans_select on public.billing_plans for select using (true);

-- billing_customers / billing_events carregam IDs de provedor — nenhuma
-- policy de select pra authenticated (sem política = acesso negado por
-- padrão sob RLS); só service role lê, sempre via edge function.

create policy subscriptions_select on public.subscriptions for select
  using (public.is_organization_member(organization_id));
create policy usage_counters_select on public.usage_counters for select
  using (public.is_organization_member(organization_id));
create policy credit_balances_select on public.credit_balances for select
  using (public.is_organization_member(organization_id));
create policy credit_transactions_select on public.credit_transactions for select
  using (public.is_organization_member(organization_id));

-- ── Seed: os 5 planos ────────────────────────────────────────────────────
insert into public.billing_plans
  (code, name, description, monthly_price_cents, annual_price_cents, features, limits, display_order)
values
  ('free', 'Descobrir', 'Plano gratuito para conhecer a plataforma.', 0, 0,
    '{"lead_search":true,"advanced_filters":false,"pipeline":true,"saved_searches":false,"search_monitoring":false,"csv_export":true,"xlsx_export":false,"message_templates":false,"cadences":false,"automations":false,"advanced_analytics":false,"team_management":false,"custom_permissions":false,"api_access":false}',
    '{"users":1,"searchesPerMonth":2,"processedLeadsPerMonth":50,"savedSearches":0,"activeMonitors":0,"pipelines":1,"messageTemplates":0,"exportRowsPerMonth":50}',
    0),
  ('solo', 'Solo', 'Para quem prospecta sozinho.', 5900, 59000,
    '{"lead_search":true,"advanced_filters":true,"pipeline":true,"saved_searches":true,"search_monitoring":false,"csv_export":true,"xlsx_export":false,"message_templates":true,"cadences":false,"automations":false,"advanced_analytics":false,"team_management":false,"custom_permissions":false,"api_access":false}',
    '{"users":1,"searchesPerMonth":60,"processedLeadsPerMonth":500,"savedSearches":10,"activeMonitors":0,"pipelines":1,"messageTemplates":20,"exportRowsPerMonth":2000}',
    1),
  ('professional', 'Profissional', 'Para quem quer monitorar e automatizar prospecção.', 11900, 119000,
    '{"lead_search":true,"advanced_filters":true,"pipeline":true,"saved_searches":true,"search_monitoring":true,"csv_export":true,"xlsx_export":true,"message_templates":true,"cadences":true,"automations":true,"advanced_analytics":true,"team_management":false,"custom_permissions":false,"api_access":false}',
    '{"users":1,"searchesPerMonth":200,"processedLeadsPerMonth":2000,"savedSearches":30,"activeMonitors":10,"pipelines":1,"messageTemplates":-1,"exportRowsPerMonth":10000}',
    2),
  ('agency', 'Agência', 'Para equipes pequenas com múltiplos responsáveis.', 29900, 299000,
    '{"lead_search":true,"advanced_filters":true,"pipeline":true,"saved_searches":true,"search_monitoring":true,"csv_export":true,"xlsx_export":true,"message_templates":true,"cadences":true,"automations":true,"advanced_analytics":true,"team_management":true,"custom_permissions":true,"api_access":false}',
    '{"users":3,"searchesPerMonth":600,"processedLeadsPerMonth":7500,"savedSearches":100,"activeMonitors":30,"pipelines":5,"messageTemplates":-1,"exportRowsPerMonth":30000}',
    3),
  ('team', 'Equipe', 'Plano personalizado — fale conosco.', null, null,
    '{"lead_search":true,"advanced_filters":true,"pipeline":true,"saved_searches":true,"search_monitoring":true,"csv_export":true,"xlsx_export":true,"message_templates":true,"cadences":true,"automations":true,"advanced_analytics":true,"team_management":true,"custom_permissions":true,"api_access":true}',
    '{"users":-1,"searchesPerMonth":-1,"processedLeadsPerMonth":-1,"savedSearches":-1,"activeMonitors":-1,"pipelines":-1,"messageTemplates":-1,"exportRowsPerMonth":-1}',
    4);

-- ── Auto-provisionamento: toda org nova nasce no plano free ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  free_plan_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.organizations (name, owner_user_id)
  values (coalesce(new.raw_user_meta_data ->> 'company_name', 'Minha organização'), new.id)
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  select id into free_plan_id from public.billing_plans where code = 'free';
  insert into public.subscriptions (organization_id, plan_id, status)
  values (org_id, free_plan_id, 'free');

  return new;
end;
$$;

-- Backfill: orgs criadas antes desta migration não têm subscription ainda.
insert into public.subscriptions (organization_id, plan_id, status)
select o.id, (select id from public.billing_plans where code = 'free'), 'free'
from public.organizations o
left join public.subscriptions s on s.organization_id = o.id
where s.id is null;

-- ── Entitlements: leitura agregada (plano + uso do período corrente) ────
-- Mesmo idioma de get_quota_status: sem checagem de membership aqui porque,
-- na Fase 1, só é chamada server-side (adminClient) por _shared/entitlements.ts,
-- nunca por RPC direto do frontend. Se a Fase 3 expuser isso ao cliente,
-- adicionar is_organization_member() aqui (mesma dívida que get_quota_status
-- já tem hoje).
create or replace function public.get_organization_entitlements(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_period_start date := date_trunc('month', now())::date;
begin
  select jsonb_build_object(
    'plan', jsonb_build_object('code', bp.code, 'name', bp.name),
    'subscriptionStatus', s.status,
    'currentPeriodEnd', s.current_period_end,
    'cancelAtPeriodEnd', s.cancel_at_period_end,
    'features', bp.features,
    'limits', bp.limits,
    'usage', coalesce(
      (select jsonb_object_agg(uc.metric, uc.quantity)
       from public.usage_counters uc
       where uc.organization_id = p_organization_id
         and uc.period_start = v_period_start),
      '{}'::jsonb
    )
  )
  into result
  from public.subscriptions s
  join public.billing_plans bp on bp.id = s.plan_id
  where s.organization_id = p_organization_id;

  return result;
end;
$$;

-- ── Uso: upsert atômico do contador do período ───────────────────────────
create or replace function public.increment_usage_counter(
  p_organization_id uuid,
  p_metric text,
  p_period_start date,
  p_period_end date,
  p_quantity bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_counters (organization_id, metric, period_start, period_end, quantity)
  values (p_organization_id, p_metric, p_period_start, p_period_end, p_quantity)
  on conflict (organization_id, metric, period_start)
  do update set quantity = public.usage_counters.quantity + excluded.quantity, updated_at = now();
$$;
