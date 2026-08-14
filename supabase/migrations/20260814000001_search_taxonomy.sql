-- Fase 2 — Taxonomy wiring on searches (spec #9–10, GAP #5).
--
-- create-search resolves the user's term (query/category) against the business
-- taxonomy — `business_taxonomies` table (20260813000003) + the domain seed
-- (packages/domain/src/taxonomy-data.ts) via resolveTaxonomy — and persists the
-- CANONICAL category + the Google Places types used for the actual search.
-- execute-search then refines the provider query with these (includedType +
-- type post-filter) instead of raw concatenation of query + category.
--
-- Additive: existing rows keep `category` (the raw user term) with
-- taxonomy_resolved=false; execute-search falls back to the old behavior.

alter table public.searches
  add column if not exists canonical_category text,
  add column if not exists places_types jsonb not null default '[]',
  add column if not exists taxonomy_id uuid references public.business_taxonomies(id) on delete set null,
  add column if not exists taxonomy_resolved boolean not null default false;

create index if not exists idx_searches_taxonomy_resolved
  on public.searches (organization_id, created_at desc)
  where taxonomy_resolved;
