-- Fase 5 — Multi-source enrichment state (spec #32, #44–45).
--
-- `enrichment_sources` em places: estado por fonte + TTL (website 30d,
-- business_registry 90d — constantes do domínio packages/domain/src/
-- enrichment-state.ts). Shape:
--   { website: {status, fetchedAt, expiresAt},
--     business_registry: {status, fetchedAt, expiresAt} }
--
-- Aditivo: o `enrichment_state`/`enrichment_fields` globais continuam
-- derivados como antes (retrocompat — a UI antiga não quebra).

alter table public.places
  add column if not exists enrichment_sources jsonb not null default '{}';
