-- ============================================================================
-- FASE 7c — REGRESSÃO P0: provider_cost SEM RLS (mesma classe da Fase 1, por
-- tabela em vez de função).
-- Migration NOVA (additive, idempotente, re-executável). NÃO edita migrations
-- anteriores. ORDEM DE DEPLOY: migrations 14+15+16 antes do código novo.
--
-- O DEFEITO (DBA + Maestro confirmaram no banco): provider_cost nasceu com
-- rls=FALSE e grants de INSERT/UPDATE/DELETE para authenticated — a tabela
-- GLOBAL de preços (sem escopo de organização) que alimenta org_mtd_api_cost_usd
-- e o budget guard. Qualquer usuário de qualquer tenant podia zerar os preços
-- (budget guard nunca dispara → gasto ilimitado no Google faturado ao dono) ou
-- inflá-los (negação de serviço para TODOS os tenants).
--
-- FIX (padrão do repo para tabela global de referência — business_taxonomies,
-- endurecido): RLS ligada + NENHUMA policy (nem SELECT: confirmado por grep que
-- só service_role/owner leem — a app e as edge functions NUNCA leem
-- provider_cost diretamente; org_mtd_api_cost_usd e get_cost_breakdown são
-- SECURITY DEFINER e leem como owner) + revoke EXPLÍCITO de
-- SELECT/INSERT/UPDATE/DELETE de anon e authenticated. Escrita só via
-- service_role (bypassa RLS por design) e owner (migrations).
--
-- P2 (DBA) — VIGÊNCIA TEMPORAL: provider_cost ganha valid_from/valid_to. Preço
-- novo = linha NOVA com valid_from = data da mudança e valid_to NULL; a linha
-- anterior recebe valid_to. org_mtd_api_cost_usd passa a casar a taxa VIGENTE
-- na data de CADA linha de uso — o histórico NÃO é mais recalculado
-- retroativamente com preço novo. Cutoff documentado: valid_from =
-- '2026-08-16T00:00:00Z' (go-live da Fase 7, quando o registro de custo
-- começou). Procedimento de bump documentado também em cost-model.ts.
--
-- P3 (DBA) — FULL SCANS do get_cost_breakdown: os 2 scans extras eram os
-- grand-totais (somas sobre a tabela inteira — nenhum índice evita). A RPC é
-- reescrita (mesma assinatura) para UMA passada com CTE: os totais derivam do
-- agrupamento, não de scans separados. O índice (provider, event_type) segue
-- para o agrupamento quando a tabela crescer.
-- ============================================================================

-- ── P0: RLS + deny-by-default ──────────────────────────────────────────────
alter table public.provider_cost enable row level security;

-- Nenhuma policy: só owner e service_role (bypass) leem/escrevem. Revokes
-- explícitos por cima do grant em massa de 20260720000003.
revoke select, insert, update, delete on public.provider_cost from anon, authenticated;

-- ── P2 (DBA): vigência temporal ─────────────────────────────────────────────
alter table public.provider_cost
  add column if not exists valid_from timestamptz not null default '-infinity',
  add column if not exists valid_to timestamptz;

comment on column public.provider_cost.valid_from is
  'Vigência da taxa. Mudança de preço = linha NOVA com valid_from novo; a linha anterior recebe valid_to. Cutoff do registro de custo (Fase 7): 2026-08-16.';

update public.provider_cost
set valid_from = '2026-08-16T00:00:00Z'
where valid_from = '-infinity';

-- org_mtd_api_cost_usd: taxa VIGENTE na data de cada linha de uso (histórico
-- imutável) — mesma assinatura.
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
    on pc.provider = u.provider
   and pc.operation = u.event_type
   and pc.valid_from <= u.created_at
   and (pc.valid_to is null or pc.valid_to > u.created_at)
  where u.organization_id = p_organization_id
    and u.created_at >= date_trunc('month', now());
$$;

-- ── P3 (DBA): get_cost_breakdown em UMA passada (sem os 2 scans extras) ─────
create or replace function public.get_cost_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin()
     and coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Uma única passada de agregação: os grand-totais derivam do agrupamento
  -- (antes eram 2 scans extras sobre a tabela inteira).
  with grouped as (
    select provider, event_type,
      count(*) c,
      coalesce(sum(estimated_cost), 0) est,
      coalesce(sum(real_cost_usd), 0) real,
      count(*) filter (where cache_hit) ch,
      count(*) filter (where coalesce(cache_hit, false) = false) cm,
      count(*) filter (where estimated_cost is null and real_cost_usd is null) unknown_cost
    from public.usage_events
    group by provider, event_type
  )
  select jsonb_build_object(
    'byProviderOperation', (select coalesce(jsonb_agg(jsonb_build_object(
      'provider', coalesce(provider, 'unknown'),
      'operation', event_type,
      'count', c,
      'estCostUsd', round(est, 4),
      'realCostUsd', round(real, 4),
      'cacheHits', ch,
      'cacheMisses', cm,
      'unknownCostCount', unknown_cost
    ) order by est desc, real desc), '[]'::jsonb) from grouped),
    'grandTotalEstCostUsd', (select coalesce(round(sum(est), 4), 0) from grouped),
    'grandTotalRealCostUsd', (select coalesce(round(sum(real), 4), 0) from grouped)
  ) into result;

  return result;
end;
$$;

-- ACL inalterada: revoke anon/authenticated/public + grant service_role
-- (já na migration 14; reafirmada por idempotência).
revoke execute on function public.get_cost_breakdown() from anon, authenticated, public;
grant execute on function public.get_cost_breakdown() to service_role;
