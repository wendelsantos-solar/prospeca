-- ============================================================================
-- FASE 7b — COST OBSERVABILITY (fechamento dos achados do Motor)
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores.
--
-- ORDEM DE DEPLOY (P2-5, Lupa) — PRÉ-REQUISITO EXPLÍCITO:
--   Esta migration DEVE ser aplicada ANTES de subir o código novo das edge
--   functions da Fase 7/7b. O CHECK de usage_events.event_type estendido está
--   na migration 14; se o código novo subir antes dela, recordUsage LANÇA nos
--   event_types novos (enrich_request, ai_message_generate, cnpj_lookup) e
--   derruba enrich/search/export/cnpj/ai em cascata. Avaliamos tornar o código
--   tolerante ao CHECK antigo por uma versão (detectar 23514 e degradar) e
--   REJEITAMOS: esconderia o erro de quem esqueceu a migration e complicaria o
--   caminho de billing. Sequência correta: migrations 14+15 primeiro, código
--   depois.
--
-- P2-3 — FONTE ÚNICA DA TABELA DE PREÇO:
--   O código NOVO lê packages/domain/src/cost-model.ts. Para o SQL antigo
--   poder ler a MESMA fonte sem reescrever migration antiga, esta migration
--   cria public.provider_cost e REDEFINE org_mtd_api_cost_usd (create or
--   replace, assinatura idêntica) para consultar a tabela. As cópias que
--   continuam embutidas em RPCs antigas NÃO tocadas estão documentadas no
--   cost-model.ts (fix_admin_membership_table, platform_admin) — migrations
--   antigas não se editam; sincronizar numa fase futura que as reescreva.
--   O teste estático rpc-authorization.test.ts garante que os números do
--   cost-model.ts e desta tabela não divergem.
--
-- P2-6 — CORTE DO PERÍODO STUB (DBA):
--   jobs.estimated_cost = 0 do período do stub é INDISTINGUÍVEL de custo real
--   zero. Backfill: linhas com cost_source NULL E estimated_cost = 0 foram
--   gravadas pelo código antigo (stampJobMetrics literal 0) — o código novo
--   sempre preenche cost_source junto com o custo (ou deixa ambos NULL para
--   desconhecido). Viramos essas para NULL + comentário de schema.
--
-- P2-7 — ÍNDICE (DBA): get_cost_breakdown fazia 3 full scans em usage_events.
-- ============================================================================

-- ── P2-3: tabela de preço SQL (espelho do cost-model.ts v1) ────────────────
create table if not exists public.provider_cost (
  provider text not null,
  operation text not null,
  -- NULL = DESCONHECIDO (regra dura da Fase 7: nunca 0 mentindo).
  input_cost_usd numeric,
  version integer not null,
  notes text,
  primary key (provider, operation)
);

-- Seeds idempotentes (espelham packages/domain/src/cost-model.ts — VERSÃO 1).
insert into public.provider_cost (provider, operation, input_cost_usd, version, notes)
values
  ('google_places',    'place_search_request',   0.035, 1, 'Text Search Enterprise por página (SKU Places API New)'),
  ('google_places',    'place_search_refresh',   0.035, 1, 'Refresh forçado = mesmo SKU de place_search_request'),
  ('google_places',    'place_details_request',  0.020, 1, 'Place Details Enterprise'),
  ('google_geocoding', 'geocode_request',        0.005, 1, 'Geocoding'),
  ('website_scraper',  'enrich_request',         0,     1, 'Infra própria — zero COMPROVADO, não desconhecido'),
  ('brasil_api',       'cnpj_lookup',            0,     1, 'BrasilAPI gratuita — zero COMPROVADO'),
  ('anthropic',        'ai_message_generate',    null,  1, 'Custo por token sem medição — DESCONHECIDO (NULL)')
on conflict (provider, operation) do update
  set input_cost_usd = excluded.input_cost_usd,
      version = excluded.version,
      notes = excluded.notes;

-- org_mtd_api_cost_usd passa a LER a tabela (mesma assinatura; fonte única).
create or replace function public.org_mtd_api_cost_usd(p_organization_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    u.quantity * coalesce(pc.input_cost_usd, 0)
  ), 0)::numeric
  from public.usage_events u
  left join public.provider_cost pc
    on pc.provider = u.provider and pc.operation = u.event_type
  where u.organization_id = p_organization_id
    and u.created_at >= date_trunc('month', now());
$$;

-- ── P2-6: backfill do período stub (0 literal -> NULL) ─────────────────────
comment on column public.jobs.estimated_cost is
  'Custo ESTIMADO (USD). NULL = desconhecido; 0 = comprovadamente zero. Linhas com 0 e cost_source NULL ANTERIORES à Fase 7 foram backfilladas para NULL (stub).';

update public.jobs
set estimated_cost = null
where estimated_cost = 0
  and cost_source is null
  and real_cost_usd is null;

-- ── P2-7: índice para get_cost_breakdown ───────────────────────────────────
create index if not exists idx_usage_events_provider_operation
  on public.usage_events (provider, event_type);
