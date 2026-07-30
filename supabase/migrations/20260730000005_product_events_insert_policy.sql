-- Radar Local — permite que o cliente grave EVENTOS DE PRODUTO em usage_events.
--
-- MOTIVO (bug corrigido): `usage_events` tem RLS habilitada desde
-- 20260719000005_rls.sql com APENAS uma policy de SELECT (`usage_select`) —
-- o comentário de lá diz "audit written by edge functions / triggers only".
-- Mas `apps/web/src/lib/analytics.ts` (track()) insere direto do browser com a
-- chave anon. Sem policy de INSERT, a RLS rejeitava 100% dessas inserções, e o
-- callback de erro era vazio ("Silently ignore persistence errors").
-- Resultado: NENHUM evento de produto era persistido — só console.debug.
-- Sem isso, o modelo de ativação (docs/PRODUCT_ACTIVATION_MODEL.md), o analytics
-- de produto e o painel de pilotos ficam sem fonte de dados.
--
-- ESCOPO DELIBERADAMENTE ESTREITO: `usage_events` é também a base de custo e de
-- quota (get_quota_status soma place_search_request/place_details_request; o
-- billing lê metric/quantity). Dar INSERT amplo ao cliente permitiria forjar
-- linha de custo, inflar contador de quota ou queimar cota de propósito.
-- Então a policy só aceita a forma exata de um evento de produto:
--   - metric preenchido       -> é evento de produto (o que a view product_events lê)
--   - event_type nulo         -> não é evento de custo de provider
--   - estimated_cost nulo     -> cliente não declara custo
--   - provider nulo           -> cliente não declara provider
--   - quantity = 1            -> não infla contador
--   - source_type fixo        -> rotulado como veio do produto
--   - user_id = auth.uid()    -> não atribui evento a outro usuário
-- Métricas de entitlement (ex: "processed_leads") continuam sendo escritas
-- somente server-side via service_role, que faz bypass de RLS.

create policy usage_events_product_insert on public.usage_events for insert
  with check (
    public.is_organization_member(organization_id)
    and metric is not null
    and event_type is null
    and estimated_cost is null
    and provider is null
    and quantity = 1
    and source_type = 'product_event'
    and user_id = auth.uid()
  );
