-- Fase 3 — Business Registry (CNPJ) columns on places (spec #104–106).
--
-- Additive: these columns are populated ONLY when a real public
-- business-registry source resolves a CNPJ. Provider data (Google Places) is
-- never overwritten — `name` stays Google-authoritative; `legal_name` is the
-- registry's razão social.

alter table public.places
  add column if not exists tax_id text,
  add column if not exists legal_name text,
  add column if not exists primary_cnae text,
  add column if not exists cnae_description text,
  add column if not exists secondary_cnaes text[] not null default '{}',
  add column if not exists registration_status text
    check (registration_status in ('active','suspended','inactive','unknown')),
  add column if not exists registration_status_description text,
  add column if not exists registration_fetched_at timestamptz;

create index if not exists idx_places_tax_id on public.places (tax_id)
  where tax_id is not null;
