-- V4 — LGPD: fecho do ponto cego do expurgo (PII de registro + QSA).
--
-- O purge_stale_discovery_pii vigente (20260812000002) anulava SÓ o grupo de
-- contato/enrichment (email/instagram/whatsapp/…) e usava UM gate temporal:
-- enriched_at < 90 dias. O PII vindo de REGISTRO (qsa — nomes de sócios;
-- registry_email; registry_phone) ficou fora do expurgo — e, mesmo que fosse
-- incluído sob o gate antigo, o critério não casaria: um place pode ter
-- registration_fetched_at SEM enriched_at (consulta de CNPJ sem enrichment de
-- contato) e vice-versa. Buraco pré-existente, exposto pela Fase 90 (QSA).
--
-- REGRA TEMPORAL POR GRUPO (argumentada): cada grupo de colunas é expurgado
-- pelo SEU próprio marcador de tempo — aquele que de fato mede a idade do
-- dado:
--   • grupo contato/enrichment (email, instagram, whatsapp, whatsapp_status,
--     enriched_at, enrichment_status, enrichment_state, enrichment_fields):
--     regido por enriched_at >= 90 dias;
--   • grupo registro (qsa, registry_email, registry_phone):
--     regido por registration_fetched_at >= 90 dias.
-- Um gate único protegeria mal os dois casos assimétricos; o CASE por grupo
-- anula exatamente o que venceu e nunca mais (place com enrichment fresco
-- não perde email porque o registro venceu, e vice-versa).
--
-- BASE LEGAL PRESERVADA: places CONVERTIDOS (existe lead apontando o place)
-- continuam INTOCADOS — o filtro `not exists (leads)` não mudou. A base legal
-- do dado de contato de leads é o relacionamento; só descoberta nunca
-- convertida é minimizada (mesma política do 20260723000006).
--
-- ALCANCE: as mesmas linhas que a política de 90 dias + não-convertido JÁ
-- alcançava, acrescidas apenas das colunas novas de registro. Nenhuma linha
-- fora da política entra no expurgo.
--
-- Agendamento: a job pg_cron 'purge-stale-discovery-pii' (03:00 UTC) chama
-- select public.purge_stale_discovery_pii(); — create or replace mantém o
-- agendamento funcionando; nenhuma job nova é criada aqui.
--
-- Retenção do QSA: documentada em docs/DATA_PRIVACY_AND_RETENTION.md
-- (PII de registro: 90 dias em places não convertidos, junto com o contato).
create or replace function public.purge_stale_discovery_pii()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.places p
     set
       -- grupo contato/enrichment — regido por enriched_at
       email        = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else email end,
       instagram    = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else instagram end,
       whatsapp     = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else whatsapp end,
       whatsapp_status = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then 'unknown' else whatsapp_status end,
       enriched_at  = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else enriched_at end,
       enrichment_status = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then null else enrichment_status end,
       enrichment_state = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then 'pending' else enrichment_state end,
       enrichment_fields = case
                        when p.enriched_at is not null
                         and p.enriched_at < now() - interval '90 days'
                        then '{}'::jsonb else enrichment_fields end,
       -- grupo registro (QSA + contatos de cadastro) — regido por
       -- registration_fetched_at
       qsa          = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else qsa end,
       registry_email = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else registry_email end,
       registry_phone = case
                        when p.registration_fetched_at is not null
                         and p.registration_fetched_at < now() - interval '90 days'
                        then null else registry_phone end
   where not exists (select 1 from public.leads l where l.place_id = p.id)
     and (
       (p.enriched_at is not null and p.enriched_at < now() - interval '90 days')
       or
       (p.registration_fetched_at is not null
        and p.registration_fetched_at < now() - interval '90 days')
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Grants idempotentes (mesma convenção da 20260815000011): internal-only.
revoke execute on function public.purge_stale_discovery_pii() from anon, authenticated, public;
grant execute on function public.purge_stale_discovery_pii() to service_role;
