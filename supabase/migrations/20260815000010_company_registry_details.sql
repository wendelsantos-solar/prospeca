-- V3-D — Company registry details (spec §18): campos empresariais adicionais
-- da BrasilAPI + observabilidade das company_sources.
--
-- ADITIVO: nada sobrescreve dados do provider Google — razão social/CNAE/
-- situação (20260813000004) continuam como estão; estas colunas recebem os
-- campos de cadastro (porte, natureza jurídica, capital, Simples/MEI,
-- abertura, endereço e contatos DO REGISTRO — registry_* para não colidir
-- com os campos do Google).

alter table public.places
  add column if not exists company_size text,
  add column if not exists legal_nature text,
  add column if not exists capital_social numeric,
  add column if not exists simples_nacional boolean,
  add column if not exists simples_opted_at date,
  add column if not exists is_mei boolean,
  add column if not exists founded_at date,
  add column if not exists registry_city text,
  add column if not exists registry_state text,
  add column if not exists registry_postal_code text,
  add column if not exists registry_email text,
  add column if not exists registry_phone text;

-- Observabilidade por fonte (V3-D): tentativas, erro e metadata livre.
alter table public.company_sources
  add column if not exists attempts integer not null default 0,
  add column if not exists error text,
  add column if not exists metadata jsonb;
