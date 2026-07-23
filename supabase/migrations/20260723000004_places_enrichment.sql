-- Discovery contact enrichment (Phase 2). Enrichment is a property of the
-- business (place), reused across searches. Populated by the enrich-discovery
-- function (website scrape). Additive: values are only filled, never nulled.
alter table public.places
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists whatsapp text,
  add column if not exists whatsapp_status text not null default 'unknown'
    check (whatsapp_status in ('unknown','possible','verified','invalid')),
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_status text;
