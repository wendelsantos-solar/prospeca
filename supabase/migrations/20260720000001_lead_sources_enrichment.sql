-- Fase 5 — Additive, non-destructive. Records data provenance + async enrichment
-- so leads are no longer tied to a single provider (Google). Nothing is dropped;
-- all adds use IF NOT EXISTS. Run only after validation.

-- ── Provider provenance per lead ────────────────────────────────────────────
create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  provider text not null,                       -- overpass | nominatim | google_places | csv | partner
  external_id text,
  source_url text,
  raw_payload jsonb,                            -- capped upstream; never exposed whole to the web
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (lead_id, provider, external_id)
);
create index if not exists idx_lead_sources_lead on public.lead_sources (lead_id);
create index if not exists idx_lead_sources_org on public.lead_sources (organization_id);
create index if not exists idx_lead_sources_provider on public.lead_sources (provider, external_id);

-- ── Async enrichment results (one row per discovered field) ─────────────────
create table if not exists public.lead_enrichments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  field text not null check (field in ('website','phone','whatsapp','email','instagram','address')),
  value text not null,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  verification text not null default 'unverified'
    check (verification in ('unverified','verified','not_found')),
  provider text not null,
  source_url text,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_lead_enrichments_lead on public.lead_enrichments (lead_id, field);
create index if not exists idx_lead_enrichments_org on public.lead_enrichments (organization_id);

-- ── Append-only score history (leads.score keeps the current value) ─────────
create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  breakdown jsonb,
  rule_version text not null,
  calculated_at timestamptz not null default now()
);
create index if not exists idx_lead_scores_lead on public.lead_scores (lead_id, calculated_at desc);

-- ── Search-level provenance + counters (additive columns) ───────────────────
alter table public.searches add column if not exists search_provider text;
alter table public.searches add column if not exists total_candidates integer;
alter table public.searches add column if not exists total_leads integer;

-- ── RLS: same org-scoped pattern as the rest of the schema ──────────────────
alter table public.lead_sources enable row level security;
alter table public.lead_enrichments enable row level security;
alter table public.lead_scores enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_sources' and policyname='lead_sources_org_read') then
    create policy lead_sources_org_read on public.lead_sources
      for select using (public.is_organization_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_enrichments' and policyname='lead_enrichments_org_read') then
    create policy lead_enrichments_org_read on public.lead_enrichments
      for select using (public.is_organization_member(organization_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_scores' and policyname='lead_scores_org_read') then
    create policy lead_scores_org_read on public.lead_scores
      for select using (public.is_organization_member(organization_id));
  end if;
end$$;

-- Writes go through Edge Functions using the service role (bypasses RLS),
-- mirroring places/search_results. No client-side insert policies by design.
