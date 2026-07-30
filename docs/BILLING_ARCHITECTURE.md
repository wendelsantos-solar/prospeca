# Arquitetura de billing — Radar Local

Status: **Fase 1 (fundação) implementada.** Provedor de pagamento ainda não
conectado — ver "Roadmap" abaixo.

## O que existia antes desta fase

Um quota fixo por organização, sem conceito de plano pago:
`organizations.monthly_search_limit` / `monthly_place_limit`, verificados ao
vivo por `get_quota_status()` / `assertSearchQuota()`
(`supabase/functions/_shared/quota.ts`). Isso **continua funcionando exatamente
como antes** — `create-search` e `execute-search` não foram tocados nesta
fase. O novo sistema de entitlements roda em paralelo, pronto pra ser
conectado quando houver um plano pago de verdade pra testar ponta a ponta
(Fase 2).

## Camadas

1. **Catálogo de planos** — `billing_plans` (migration
   `20260729000002_billing_foundation.sql`). Preço, `features` (jsonb) e
   `limits` (jsonb) por plano, editável sem deploy. Ver
   [PLANS_AND_ENTITLEMENTS.md](./PLANS_AND_ENTITLEMENTS.md).
2. **Assinatura** — `subscriptions`, 1:1 com `organizations`. Toda org nasce
   com uma subscription `status='free'` apontando pro plano `free`
   (`handle_new_user()` trigger). `provider`/`provider_subscription_id`
   ficam `null` até a Fase 2 (Stripe) existir.
3. **Cliente do provedor** — `billing_customers` (organization_id ↔
   provider_customer_id). Vazia até a Fase 2.
4. **Uso** — dois níveis:
   - `usage_events`: log bruto, um insert por consumo (auditoria, replay).
     Estendida (não substituída) da tabela que já existia pro custo de API —
     ganhou `metric`/`idempotency_key`/`source_type`/`source_id`, todas
     nullable, pra não quebrar os escritores antigos (`event_type`/`provider`).
   - `usage_counters`: agregado por `(organization_id, metric,
period_start)`, mantido via upsert atômico (`increment_usage_counter`
     RPC) — é o que o motor de entitlements lê, não a soma ao vivo de
     `usage_events` (mais barato em escala).
5. **Créditos** — `credit_balances` (saldo atual) + `credit_transactions`
   (log). Schema pronto, sem lógica de consumo ainda — isso é Fase 1
   parcial: a _forma_ dos créditos existe, a compra/consumo real (Fase 2/4)
   não.
6. **Eventos de webhook** — `billing_events`, guarda o payload bruto +
   `provider_event_id` único (idempotência de webhook). Vazia até a Fase 2.

## Entitlements engine

Dois arquivos espelhados (mesmo motivo do `_shared/address.ts` — Deno não
importa pacotes npm do monorepo):

- `packages/domain/src/entitlements.ts` — puro, sem I/O. `FeatureKey`,
  `PlanEntitlements`, `hasFeature()`, `remaining()`, `canConsume()`. Usado
  pelo frontend (Fase 3) pra decidir o que mostrar/esconder na UI.
- `supabase/functions/_shared/entitlements.ts` — faz I/O de verdade.
  `getEntitlements()` (chama a RPC `get_organization_entitlements`),
  `assertFeatureAccess()`, `assertUsageAvailable()`,
  `recordEntitlementUsage()`. **Autoridade real é sempre o backend** — a UI
  pode esconder um botão, mas quem barra é essa camada.

Regra: nenhuma checagem de plano deve virar `if (plan === "x")` espalhado
pelo código. Toda decisão de acesso passa por `hasFeature`/`assertFeatureAccess`
lendo `billing_plans.features`, nunca comparando o código do plano
diretamente.

## Convenção `-1`

Em `limits`, o valor `-1` significa ilimitado/personalizado (usado no plano
`team` e em `messageTemplates` de planos onde não há teto). `remaining()` e
`assertUsageAvailable()` tratam `-1` como "sem limite" — nunca subtraem uso
dele.

## Roadmap (não implementado nesta fase)

| Fase | Escopo                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2    | `BillingProvider` (Stripe), checkout, webhooks, portal de cobrança                                                                                              |
| 3    | UI: `/app/configuracoes/plano`, comparação de planos, upgrade contextual                                                                                        |
| 4    | Ciclo de vida: upgrade/downgrade com aviso de impacto, cancelamento, trial, falha de pagamento                                                                  |
| 5    | Admin: métricas de receita, cupons, plano fundador                                                                                                              |
| 6    | Testes de integração/E2E, `BILLING_SETUP.md`, `BILLING_WEBHOOKS.md`, `USAGE_AND_CREDITS.md`, `BILLING_SECURITY.md`, `BILLING_TESTING.md`, e-mails transacionais |

Provedor escolhido: **Stripe** (Billing Portal nativo, suporte a PIX/boleto
no Brasil, decisão registrada ao aprovar este plano). `STRIPE_SECRET_KEY`
seguirá o padrão de secret já usado pro Google
(`supabase/functions/_shared/google.ts:58-62` — getter lazy, nunca logado).
