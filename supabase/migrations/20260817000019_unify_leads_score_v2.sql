-- FASE 3 — UNIFICAÇÃO DE SCORE: leads.score passa a carregar o V2
-- (opportunity-score, v1.2.0) — a engine canônica. O v3 (score.ts) fica
-- marcado como LEGADO no código para rollback e leitura histórica.
--
-- DECISÃO ARGUMENTADA — coluna materializada, não join:
--   * As leituras do cliente (apps/web/src/lib/filters.ts:44,45,84,103
--     filtra/ordena por lead.score; kanban, painel, realtime, export) leem a
--     coluna diretamente. Materializar o V2 nela preserva o contrato e todos
--     os caminhos de ordenação/filtro sem mudança de cliente.
--   * Drift controlado: UM escritor canônico do V2 — score-company — passa a
--     sincronizar leads.score na mesma operação em que grava
--     company_opportunity_scores. import-search-results e calculate-lead-score
--     só COPIAM o V2 persistido (ou caem no fallback legado abaixo).
--
-- NÃO-DESTRUTIVO (limite duro do usuário):
--   * score_legacy_v3 preserva o v3 ANTES da primeira sobrescrita;
--   * lead SEM V2 calculado NÃO fica sem score nem vira 0: mantém o v3
--     (marcado 'legacy-v3.0.0') e já é coberto pelos jobs OPPORTUNITY_SCORING
--     que import-search-results enfileira por busca — converge quando o V2
--     chega (score-company sobrescreve e a coluna legacy permanece).
--
-- ROLLBACK (documentado, NÃO executado):
--   update public.leads
--      set score = score_legacy_v3,
--          score_rule_version = 'legacy-v3.0.0'
--    where score_legacy_v3 is not null;
--   -- e, quando quiser descartar a coluna: alter table ... drop column score_legacy_v3;

alter table public.leads
  add column if not exists score_legacy_v3 integer;

-- Backfill idempotente: preserva o v3 e copia o V2 MAIS RECENTE por (org, place).
update public.leads l
   set score_legacy_v3 = coalesce(l.score_legacy_v3, l.score),
       score = cos.score,
       score_rule_version = cos.rule_version,
       temperature = cos.temperature
  from (
    select distinct on (organization_id, place_id)
           organization_id, place_id, score, temperature, rule_version
      from public.company_opportunity_scores
     order by organization_id, place_id, calculated_at desc
  ) cos
 where cos.organization_id = l.organization_id
   and cos.place_id = l.place_id
   and l.score_legacy_v3 is null;

-- Leads SEM V2: marca o v3 como legado — o número permanece (nunca 0).
update public.leads
   set score_rule_version = 'legacy-v3.0.0'
 where score_rule_version is null
    or score_rule_version = ''
    or score_rule_version = 'v3.0.0';
