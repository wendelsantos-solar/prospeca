-- Company Intelligence — endereço oficial + matriz/filial (brief §14).
--
-- ADITIVO. Fecha os últimos campos do brief que a fonte JÁ devolvia e que o
-- adapter descartava: logradouro/número/complemento, bairro e o identificador
-- matriz/filial. Prefixo registry_* pela mesma razão das colunas de
-- 20260815000010 — o endereço do Google (`address`) é outro dado, de outra
-- fonte, e nunca é sobrescrito.
--
-- `establishment_type` é o vocabulário canônico do domínio
-- (packages/domain/src/business-registry.ts :: EstablishmentType), não o
-- código cru da RFB — o código não sai do adapter.

alter table public.places
  add column if not exists registry_street_address text,
  add column if not exists registry_district text,
  add column if not exists establishment_type text
    check (establishment_type in ('headquarters', 'branch', 'unknown'));
