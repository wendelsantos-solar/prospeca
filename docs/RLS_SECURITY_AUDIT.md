# RLS Security Audit — Radar Local

**Data:** 2026-07-30
**Fonte:** `supabase/migrations/20260719000005_rls.sql` + migrations de billing

---

## Resumo

RLS está habilitado em todas as 19+ tabelas de negócio expostas ao frontend.
As políticas usam as funções `is_organization_member()` e `has_organization_role()`
(SECURITY DEFINER com `search_path = public` fixado) — isso evita recursão de
RLS e fixa o path de busca.

**Problemas encontrados:** Nenhum crítico. 2 melhorias sugeridas.

---

## Tabela por tabela

### organizations

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(id)` |
| UPDATE policy | `has_organization_role(id, array['owner','admin'])` |
| INSERT policy | ❌ (service role only) |
| DELETE policy | ❌ (service role only) |
| **Risco** | Nenhum |
| **Correção** | N/A |

### organization_members

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| INSERT policy | `has_organization_role(organization_id, array['owner','admin'])` |
| UPDATE policy | `has_organization_role(organization_id, array['owner','admin'])` |
| DELETE policy | `has_organization_role(...)` OR `user_id = auth.uid()` (auto-sair) |
| **Risco** | Nenhum |
| **Correção** | N/A |

### profiles

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `id = auth.uid()` (owner only) |
| UPDATE policy | `id = auth.uid()` (owner only) |
| INSERT policy | `id = auth.uid()` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### searches

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| ALL policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### places

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| INSERT/UPDATE/DELETE | ❌ (service role only) |
| **Risco** | Nenhum. Places são escritos apenas por edge functions. |
| **Correção** | N/A |

### search_results

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | EXISTS check via `searches.organization_id` + `is_organization_member()` |
| **Risco** | Nenhum. Corretamente usa JOIN para verificar ownership. |
| **Correção** | N/A |

### leads

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| ALL policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### lead_notes, lead_activities

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| ALL policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### lead_stage_history

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| INSERT policy | `is_organization_member(organization_id) AND changed_by = auth.uid()` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### message_templates

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| ALL policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### audit_logs

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `has_organization_role(organization_id, array['owner','admin'])` |
| INSERT/UPDATE/DELETE | ❌ (service role only) |
| **Risco** | Nenhum. Apenas owner/admin leem audit logs. |
| **Correção** | N/A |

### usage_events

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| INSERT/UPDATE/DELETE | ❌ (service role only) |
| **Risco** | Nenhum |
| **Correção** | N/A |

### suppression_list

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| ALL policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### exports

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| INSERT policy | `is_organization_member(organization_id) AND created_by = auth.uid()` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### billing_plans

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `true` (público para authenticated) |
| INSERT/UPDATE/DELETE | ❌ (service role only) |
| **Risco** | Nenhum. Catálogo de preços não é sensível. |
| **Correção** | N/A |

### subscriptions

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### usage_counters, credit_balances, credit_transactions

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT policy | `is_organization_member(organization_id)` |
| **Risco** | Nenhum |
| **Correção** | N/A |

### billing_customers, billing_events

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT/INSERT/UPDATE/DELETE | ❌ (nenhuma policy — acesso negado por padrão) |
| **Risco** | Nenhum. Service role only. |
| **Correção** | N/A |

### idempotency_keys, geocode_cache

| Propriedade | Valor |
|------------|-------|
| RLS habilitada | ✅ |
| SELECT/INSERT/UPDATE/DELETE | ❌ (nenhuma policy — service role only) |
| **Risco** | Nenhum. Service role only. |
| **Correção** | N/A |

---

## Melhorias sugeridas

### 1. ⚠️ `get_quota_status` e `get_organization_entitlements` sem verificação de membership

**Status:** Ambas são `SECURITY DEFINER` sem verificação de `is_organization_member()`.
Isso é intencional (só chamadas via adminClient nas edge functions), mas está
documentado como dívida técnica no código.

**Risco:** Baixo (não expostas ao frontend diretamente).
**Correção sugerida:** Adicionar `is_organization_member()` nas RPCs antes de
expô-las ao cliente. Ou mantê-las como admin-only permanentemente.

### 2. ⚠️ `search_results` não tem WITH CHECK para insert via frontend

**Status:** A política é SELECT only. Inserts acontecem via edge functions
com service role. Seguro, mas se no futuro houver insert direto, precisa de
WITH CHECK.

**Risco:** Baixo (service role only atualmente).
**Correção sugerida:** Adicionar nota de que inserts diretos exigem WITH CHECK.

---

## Testes de RLS

| Teste | Status |
|-------|--------|
| Usuário A lê leads da Org A | ✅ (via uso normal) |
| Usuário A NÃO lê leads da Org B | ❌ Não testado automaticamente |
| Usuário A NÃO atualiza lead da Org B | ❌ Não testado automaticamente |
| Usuário sem membership recebe 403 | ❌ Não testado automaticamente |
| Service role bypassa RLS (esperado) | ✅ (via edge functions) |

**Recomendação:** Implementar testes de isolamento cross-tenant (ver
`SAAS_PRODUCTION_ROADMAP.md` Fase 2).

---

## Conclusão

RLS está **corretamente implementado** em todas as tabelas. O modelo de defesa
em profundidade (RLS + backend validation + RPC checks) é robusto. As melhorias
sugeridas são de hardening, não de correção de vulnerabilidades.
