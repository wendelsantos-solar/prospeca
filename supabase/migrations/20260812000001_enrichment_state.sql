-- Enrichment state machine per business (place).
--
-- Before this, `places.enrichment_status` was free text ("ok"/"not_found"/
-- "blocked") written only by enrich-discovery, and never read by the UI. That
-- made the frontend show "Não encontrado" for email/instagram/whatsapp on
-- businesses that were simply NEVER checked — conflating "não possui" with
-- "ainda não verificamos".
--
-- New model (additive, nothing dropped):
--   enrichment_state    = overall machine: pending | processing | enriched |
--                         partial | failed (DERIVED from the per-field map).
--   enrichment_fields   = jsonb { email|instagram|whatsapp: {status, has} }.
--                         A missing key means the field is still `pending`.
--
-- The two new columns live alongside the legacy `enrichment_status`/
-- `enriched_at` for back-compat; the latter keeps its role as the staleness
-- timestamp for the re-enrich gate.

alter table public.places
  add column if not exists enrichment_state text not null default 'pending'
    check (enrichment_state in ('pending', 'processing', 'enriched', 'partial', 'failed'));

alter table public.places
  add column if not exists enrichment_fields jsonb not null default '{}'::jsonb;

-- Backfill from the legacy signals so already-enriched rows don't read as
-- "pending" (which the UI would render as "ainda não verificamos"):
--   blocked     → failed   (scrape was rejected/errored)
--   ok/not_found→ enriched (checked; found or genuinely absent)
--   null        → pending  (never checked — the honest default)
update public.places
   set enrichment_state = case
         when enrichment_status = 'blocked' then 'failed'
         when enrichment_status is not null then 'enriched'
         else 'pending'
       end
 where enrichment_state = 'pending'
   and enrichment_status is not null;

create index if not exists idx_places_enrichment_state
  on public.places (enrichment_state)
  where enrichment_state in ('pending', 'processing');
