-- Fase 6 / P4b — Additive. Caches provider (Overpass) result sets keyed by
-- region+category so equivalent recent searches skip the external call.
create table if not exists public.provider_search_cache (
  cache_key text primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null,
  payload jsonb not null,               -- normalized candidate list (not raw upstream)
  result_count integer not null default 0,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists idx_provider_cache_expiry on public.provider_search_cache (expires_at);
create index if not exists idx_provider_cache_org on public.provider_search_cache (organization_id);

alter table public.provider_search_cache enable row level security;
-- Written/read only by Edge Functions via service role (bypasses RLS).
-- No client policies by design.
