# Planos e entitlements — Radar Local

Fonte da verdade: tabela `billing_plans` (seed em
`supabase/migrations/20260729000002_billing_foundation.sql`). Os valores
abaixo são os hipóteses iniciais definidas nesta fase — mudar preço/limite é
um `update billing_plans set ...`, não um deploy.

## Planos

| code           | Nome         | Mensal        | Anual         | Usuários       | Leads/mês      |
| -------------- | ------------ | ------------- | ------------- | -------------- | -------------- |
| `free`         | Descobrir    | R$ 0          | R$ 0          | 1              | 50             |
| `solo`         | Solo         | R$ 59         | R$ 590        | 1              | 500            |
| `professional` | Profissional | R$ 119        | R$ 1.190      | 1              | 2.000          |
| `agency`       | Agência      | R$ 299        | R$ 2.990      | 3              | 7.500          |
| `team`         | Equipe       | personalizado | personalizado | ilimitado (-1) | ilimitado (-1) |

## Features por plano

| Feature              | free | solo | professional | agency | team |
| -------------------- | :--: | :--: | :----------: | :----: | :--: |
| `lead_search`        |  ✅  |  ✅  |      ✅      |   ✅   |  ✅  |
| `advanced_filters`   |  ❌  |  ✅  |      ✅      |   ✅   |  ✅  |
| `pipeline`           |  ✅  |  ✅  |      ✅      |   ✅   |  ✅  |
| `saved_searches`     |  ❌  |  ✅  |      ✅      |   ✅   |  ✅  |
| `search_monitoring`  |  ❌  |  ❌  |      ✅      |   ✅   |  ✅  |
| `csv_export`         |  ✅  |  ✅  |      ✅      |   ✅   |  ✅  |
| `xlsx_export`        |  ❌  |  ❌  |      ✅      |   ✅   |  ✅  |
| `message_templates`  |  ❌  |  ✅  |      ✅      |   ✅   |  ✅  |
| `cadences`           |  ❌  |  ❌  |      ✅      |   ✅   |  ✅  |
| `automations`        |  ❌  |  ❌  |      ✅      |   ✅   |  ✅  |
| `advanced_analytics` |  ❌  |  ❌  |      ✅      |   ✅   |  ✅  |
| `team_management`    |  ❌  |  ❌  |      ❌      |   ✅   |  ✅  |
| `custom_permissions` |  ❌  |  ❌  |      ❌      |   ✅   |  ✅  |
| `api_access`         |  ❌  |  ❌  |      ❌      |   ❌   |  ✅  |

`free` tem `pipeline`/`csv_export` = true mas com `limits` bem baixos
(1 pipeline, 50 linhas de exportação/mês) — a feature existe, o volume é
que é mínimo. Isso é intencional: bloquear por _limite_, não por feature
flag, quando o recurso em si deveria estar disponível pra experimentar.

## Limites (`limits`, valores por plano)

| metric                   | free | solo  | professional | agency | team |
| ------------------------ | ---- | ----- | ------------ | ------ | ---- |
| `users`                  | 1    | 1     | 1            | 3      | -1   |
| `searchesPerMonth`       | 2    | 60    | 200          | 600    | -1   |
| `processedLeadsPerMonth` | 50   | 500   | 2.000        | 7.500  | -1   |
| `savedSearches`          | 0    | 10    | 30           | 100    | -1   |
| `activeMonitors`         | 0    | 0     | 10           | 30     | -1   |
| `pipelines`              | 1    | 1     | 1            | 5      | -1   |
| `messageTemplates`       | 0    | 20    | -1           | -1     | -1   |
| `exportRowsPerMonth`     | 50   | 2.000 | 10.000       | 30.000 | -1   |

`-1` = ilimitado/personalizado. Nunca comparar contra `-1` diretamente fora
de `packages/domain/src/entitlements.ts` — use `remaining()`/`canConsume()`,
que já tratam o caso.

## Como consultar (backend)

```ts
import {
  getEntitlements,
  assertFeatureAccess,
  assertUsageAvailable,
  recordEntitlementUsage,
} from "../_shared/entitlements.ts";

// bloqueia se o plano não tiver a feature
await assertFeatureAccess(ctx.adminClient, ctx.organizationId, "search_monitoring");

// bloqueia se o consumo estourar o limite do período corrente
await assertUsageAvailable(ctx.adminClient, ctx.organizationId, "processedLeadsPerMonth", count);

// registra o consumo real (só depois que o processamento aconteceu de fato)
await recordEntitlementUsage(ctx.adminClient, {
  organizationId: ctx.organizationId,
  metric: "processedLeadsPerMonth",
  quantity: count,
  sourceType: "search_result",
  sourceId: searchId,
});
```

Regra de consumo (a valer quando isso for conectado a um fluxo real, Fase
2+): **1 crédito = 1 empresa processada**, contabilizado uma única vez —
não consumir de novo ao reabrir uma busca salva, revisitar um lead já
armazenado, ou repetir um retry idempotente. `idempotencyKey` em
`recordEntitlementUsage` existe exatamente pra isso: um retry com a mesma
chave é um no-op (índice único em `usage_events`).

## O que ainda não existe

Nada disto está conectado a nenhum fluxo real ainda — é a fundação,
não a aplicação. `create-search`/`execute-search` continuam gateados só
pelo quota antigo (`_shared/quota.ts`). Conectar os dois sistemas é
trabalho da Fase 2, quando o plano pago via Stripe existir de fato pra
testar ponta a ponta (upgrade → feature libera → consumo é registrado →
limite bloqueia).
