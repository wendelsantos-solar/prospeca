-- Google Calendar + Meet integration foundation.
-- Safe connection metadata is separated from encrypted OAuth credentials.

alter table public.lead_activities
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists attendee_email text;

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  provider_account_id text,
  account_email text,
  status text not null default 'connected'
    check (status in ('connected', 'reconnect_required', 'error')),
  scopes text[] not null default '{}',
  settings jsonb not null default '{"calendar_id":"primary","create_meet":true}'::jsonb,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, provider)
);

create index idx_integration_connections_org
  on public.integration_connections (organization_id, provider, status);
create trigger trg_integration_connections_updated before update on public.integration_connections
  for each row execute function public.set_updated_at();

create table public.integration_credentials (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  encrypted_payload text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
create trigger trg_integration_credentials_updated before update on public.integration_credentials
  for each row execute function public.set_updated_at();

create table public.integration_oauth_states (
  state_hash text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_integration_oauth_states_expires
  on public.integration_oauth_states (expires_at);

create table public.activity_external_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.lead_activities(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  external_event_id text not null,
  calendar_id text not null default 'primary',
  html_url text,
  meeting_url text,
  etag text,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, activity_id),
  unique (connection_id, external_event_id)
);
create index idx_activity_external_events_activity
  on public.activity_external_events (activity_id);
create trigger trg_activity_external_events_updated before update on public.activity_external_events
  for each row execute function public.set_updated_at();

alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.integration_oauth_states enable row level security;
alter table public.activity_external_events enable row level security;

-- Connections are personal inside a workspace. Mutations remain server-only so
-- OAuth state and token lifecycle cannot be bypassed from the browser.
create policy integration_connections_select_own
  on public.integration_connections for select
  using (
    user_id = auth.uid()
    and public.is_organization_member(organization_id)
  );

-- Everyone in the workspace may see the Calendar/Meet link attached to a CRM
-- activity, but only the Edge Function can create or update the link.
create policy activity_external_events_select_org
  on public.activity_external_events for select
  using (public.is_organization_member(organization_id));

revoke all on public.integration_connections from anon, authenticated;
revoke all on public.integration_credentials from anon, authenticated;
revoke all on public.integration_oauth_states from anon, authenticated;
revoke all on public.activity_external_events from anon, authenticated;
grant select on public.integration_connections to authenticated;
grant select on public.activity_external_events to authenticated;
grant all on public.integration_connections to service_role;
grant all on public.integration_credentials to service_role;
grant all on public.integration_oauth_states to service_role;
grant all on public.activity_external_events to service_role;

comment on table public.integration_credentials is
  'Server-only AES-GCM encrypted OAuth tokens. Never exposed to authenticated clients.';
comment on table public.integration_oauth_states is
  'Short-lived, one-time OAuth state hashes used to prevent callback CSRF.';
