# Multi-Tenancy Decision — Radar Local

**Data:** 2026-07-30
**Decisão:** Confirmar e documentar o modelo existente

---

## O projeto já é multi-tenant?

**Sim.** O Radar Local foi projetado como multi-tenant desde a primeira
migration (`20260719000001_core.sql`).

## Qual é o tenant?

**Organization** (`organizations`).

- Nome técnico interno: **organization**
- Nome na interface: **Workspace** (para o usuário final)
- Campo: `organization_id` (UUID)

## Modelo utilizado

```text
Multi-tenant por banco compartilhado
+
dados logicamente isolados por organization_id
+
autorização no backend (Edge Functions)
+
RLS em todas as tabelas de negócio
```

## Justificativa

1. **Simplicidade operacional:** Um banco para gerenciar, backups, migrations.
2. **Custo:** Sem custo adicional por tenant (ideal para beta com dezenas de
   organizações).
3. **RLS nativo:** Supabase/PostgreSQL suporta RLS nativamente, tornando o
   isolamento por `organization_id` robusto e com baixa manutenção.
4. **Escala:** Para centenas de organizações, este modelo continua funcionando.
   Para milhares, considere sharding ou bancos separados (não necessário agora).

## Modelo de dados do tenant

### Usuário → Organização

```text
User (auth.users)
  │
  └─ OrganizationMembership (organization_members)
       │  role: owner | admin | member
       │  status: active (implícito)
       │
       └─ Organization (organizations)
            │  name, slug, plan, status
            │
            └─ Todos os dados de negócio
                 leads, searches, places, pipelines, activities, etc.
```

### Auto-provisionamento

No signup, o trigger `handle_new_user()`:
1. Cria `profiles` row
2. Cria `organizations` row (nome = company_name do metadata ou "Minha organização")
3. Cria `organization_members` row (role = owner)
4. Cria `subscriptions` row (plan = free)

### Membership e roles

| Role | Permissões |
|------|-----------|
| `owner` | Acesso total à organização, gerencia membros, admin |
| `admin` | Gerencia membros, acessa audit logs, edita organização |
| `member` | Acesso aos dados de negócio (leads, buscas, pipeline) |

Para o beta inicial, `owner` e `member` são suficientes na interface.

### Usuário em múltiplas organizações

O schema suporta (`organization_members` permite múltiplas rows por `user_id`).
O frontend atualmente resolve pegando a primeira membership — isso precisa ser
melhorado com um seletor de workspace.

## Dados que pertencem ao tenant

Todas as tabelas de negócio têm `organization_id`:
- searches, places, search_results
- leads, lead_notes, lead_activities, lead_stage_history
- message_templates
- suppression_list
- exports
- usage_events, usage_counters, credit_balances, credit_transactions
- audit_logs

## Dados globais (sem organization_id)

- `billing_plans` — catálogo de planos (público para authenticated)
- `geocode_cache` — cache de geocodificação (dados derivados, service role only)
- `profiles` — perfil do usuário (user-scoped)
- `auth.users` — gerenciado pelo Supabase

## Como o tenant é resolvido

### Backend (Edge Functions)

```typescript
// supabase/functions/_shared/auth.ts
export async function requireAuth(req: Request, organizationId?: string): Promise<AuthContext> {
  // 1. Extrai JWT do header Authorization
  // 2. Valida sessão com Supabase Auth
  // 3. Consulta organization_members (admin client)
  // 4. Retorna { userId, organizationId, role, userClient, adminClient }
}
```

### Frontend

Atualmente o frontend resolve a organização pegando a primeira membership:

```typescript
// Exemplo de padrão usado em SupabaseDashboardRepository e SupabaseLeadRepository
const { data: memberships } = await supabase
  .from("organization_members")
  .select("organization_id")
  .limit(1);
const organizationId = memberships?.[0]?.organization_id;
```

**Limitação:** Funciona para beta (1 organização por usuário), mas precisa
evoluir para um seletor de workspace.

## Como impedir acesso cruzado

### Camada 1: RLS (banco)

Toda query do frontend passa pelo RLS que verifica `is_organization_member(organization_id)`.

### Camada 2: Backend validation

Toda edge function usa `requireAuth()` que valida membership antes de qualquer
operação.

### Camada 3: RPCs com verificação inline

Funções como `move_lead_stage` verificam `is_organization_member()` dentro da
transação.

### Camada 4: Service role restrito

Edge functions que usam service role (`execute-search`, `recover-stuck-searches`,
etc.) NÃO aceitam `organization_id` do cliente — resolvem internamente.

## Migração de dados existentes

Não necessária. O schema já nasceu com `organization_id` e o backfill é
automático via `handle_new_user()` trigger.

## Estratégia de rollback

Como não há migração de dados para fazer, o rollback é simples:
- Remover novas tabelas/migrations da feature branch
- Manter compatibilidade com schema existente

---

## Decisão final

**MANTER o modelo atual.** O banco compartilhado com RLS é a escolha correta
para o estágio atual do Radar Local. Não há necessidade de migrar para schemas
ou bancos separados.

### O que implementar agora:
1. Sistema de convites (`organization_invitations`)
2. Melhorar resolução de tenant no frontend (contexto ou hook centralizado)
3. Testes de isolamento cross-tenant
4. Suporte a múltiplas organizações por usuário no frontend (seletor)
