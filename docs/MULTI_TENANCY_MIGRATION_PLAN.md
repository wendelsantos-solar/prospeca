# Multi-Tenancy Migration Plan — Radar Local

**Data:** 2026-07-30
**Complemento de:** `docs/MULTI_TENANCY_DECISION.md`

---

## 1. Conclusão de partida: não há migração estrutural a fazer

O §12 do plano de readiness assume o caso "as tabelas atuais não possuem tenant".
**Não é o caso do Radar Local.** Evidência:

- `supabase/migrations/20260719000001_core.sql` (a **primeira** migration) já cria
  `organizations` e `organization_members`.
- Toda tabela de negócio nasceu com
  `organization_id uuid not null references public.organizations(id) on delete cascade`.
  Verificado em `leads`, `searches`, `places`, `lead_notes`, `lead_activities`,
  `lead_stage_history`, `message_templates`, `exports`, `suppression_list`,
  `usage_events`, `audit_logs`, `idempotency_keys`.
- `20260719000005_rls.sql` habilita RLS nas 17 tabelas de negócio e aplica
  policies via `is_organization_member()` / `has_organization_role()`.

Portanto **não** se aplica nada disto: criar `organization_id`, backfill,
identificar órfãos, adicionar `NOT NULL` depois do backfill. Os campos já são
`NOT NULL` desde a criação, e não existem registros pré-tenant.

Escrever uma migração de tenancy aqui seria trabalho inventado. O que existe de
verdade são **três defeitos de resolução e de handoff de tenant**, corrigidos
nesta sessão e documentados abaixo com o respectivo plano de rollback.

---

## 2. O que efetivamente mudou

### M1 — Resolução de organização não determinística

**Problema.** Dois pontos de código resolviam a organização com
`from("organization_members").select("organization_id").limit(1)` — sem `ORDER BY`
e sem filtro de usuário (`apps/web/src/repositories/supabase.ts`, na escrita da
`suppression_list` e no `get_dashboard_overview`). A RLS impede ver membership de
outro usuário, então **não era vazamento**; mas com 2+ organizações o Postgres
devolve as linhas em ordem arbitrária, e a organização "escolhida" podia mudar
entre dois carregamentos.

**Por que isso deixou de ser hipotético.** `handle_new_user()`
(`20260729000002_billing_foundation.sql`) cria uma organização Free para **todo**
usuário novo. Quem entra por convite (todo piloto) termina com duas: a Free
automática e a do convite. O cenário de 2+ organizações é a regra no beta, não a
exceção.

**Correção.**

- `apps/web/src/lib/tenant.ts` passa a ser a única fonte de resolução:
  `resolveActiveOrganizationId()` (fora do React) e `useTenant()` (hook).
- Ordem total e estável: `.order("created_at").order("organization_id")`.
- Filtro explícito `.eq("user_id", ...)` — redundante com a RLS, mantido como
  defesa em profundidade.
- Seleção explícita persistida (`radar.activeOrganizationId` em `localStorage`),
  honrada só se ainda for uma membership válida.
- Os dois call sites em `repositories/supabase.ts` passaram a usar o resolvedor.

**Rollback.** Reverter `lib/tenant.ts` e os dois call sites. Sem mudança de
schema, sem dado migrado — rollback é puramente de código.

### M2 — Convite nunca era consumido

**Problema.** `create-pilot` cria a organização, o convite e envia o link
`/cadastro?invitation=<token>`. `cadastro.tsx` guardava o token em
`user_metadata.invitation_token`. A edge function `accept-invitation` existia e
estava deployada — mas **nenhum código de frontend a chamava**. O convidado
ficava só com a organização Free automática e nunca entrava na organização do
piloto.

**Correção.** `apps/web/src/hooks/usePendingInvitation.ts`, chamado no
`AppLayout`: no primeiro carregamento autenticado, consome o token, fixa a
organização do convite como ativa, invalida o cache de tenant e limpa o token do
metadata em qualquer desfecho (token de uso único não deve ser retentado a cada
load). O aceite não pode acontecer no submit do cadastro porque o cadastro exige
confirmação de e-mail — não há sessão naquele momento.

**Rollback.** Remover a chamada `usePendingInvitation()` do `AppLayout`. Convites
já aceitos permanecem válidos (a membership está persistida); nada a desfazer no
banco.

### M3 — Propriedade da organização do piloto não era transferida

**Problema.** `create-pilot` cria a organização com
`owner_user_id: userId` (o admin da plataforma), comentado no código como
"temporarily owned by admin" — e nada transferia depois.

**Impacto real, medido.** _Não_ é vazamento de acesso: `is_organization_member()`
e `has_organization_role()` leem exclusivamente `organization_members`;
`owner_user_id` **não** aparece em nenhuma policy de RLS (verificado por busca em
todas as migrations). O impacto é de integridade de dado e de ownership
(billing, futura transferência de conta), não de autorização. Severidade baixa.

**Correção.** `accept-invitation` transfere `owner_user_id` para o usuário que
aceita, quando o convite é de `role = 'owner'` **e** o dono atual não é membro
real da organização (isto é, é o admin que só criou o registro). Também avança
`pilot_status` de `invited` para `onboarding`, com guarda
`.eq("pilot_status","invited")` para não regredir piloto já `active`/`completed`.

**Rollback.** Reverter o bloco em `accept-invitation/index.ts`. Para desfazer
dados já alterados:

```sql
-- Reverter ownership de uma organização específica para o admin que a criou
update public.organizations
   set owner_user_id = '<admin-user-id>'
 where id = '<organization-id>';

-- Reverter pilot_status
update public.organizations
   set pilot_status = 'invited'
 where id = '<organization-id>' and pilot_status = 'onboarding';
```

---

## 3. Mudanças de schema desta sessão

Duas migrations, **ambas puramente aditivas**. Nenhuma altera coluna existente,
nenhuma apaga dado, nenhuma tem passo destrutivo.

### `20260730000004_rate_limit_events.sql`

Cria `rate_limit_events` (contador antiabuso) + `purge_rate_limit_events()` +
job pg*cron horário. Motivo: `_shared/rate-limit.ts` gravava o contador em
`usage_events` com `event_type='rate_limit*\*'`, violando o CHECK da coluna; o erro
não era verificado, então o contador nunca incrementava e o limite nunca
disparava. Bug reproduzido em banco local (`check_violation` confirmado).

Escopo passou de `organization_id` (FK obrigatória) para `scope_key text` sem FK,
porque aceitar convite acontece **antes** de existir organização resolvida.

**Rollback:**

```sql
select cron.unschedule('purge-rate-limit-events');
drop function if exists public.purge_rate_limit_events();
drop table if exists public.rate_limit_events;
```

Perde-se apenas a janela de contagem corrente (dados descartáveis por natureza).

### `20260730000005_product_events_insert_policy.sql`

Adiciona a policy `usage_events_product_insert`. Motivo: `usage_events` tinha RLS
com **apenas** policy de SELECT, então todo INSERT de evento de produto feito pelo
browser (`lib/analytics.ts`) era rejeitado pela RLS e o erro era engolido — zero
eventos de produto persistidos, ou seja, beta sem fonte de dados para ativação.

A policy é deliberadamente estreita porque `usage_events` também é a base de
custo e quota: exige `metric` preenchido, `event_type`/`estimated_cost`/`provider`
nulos, `quantity = 1`, `source_type = 'product_event'` e `user_id = auth.uid()`.
Coberto por testes (ISO-017 a ISO-020).

**Rollback:**

```sql
drop policy if exists usage_events_product_insert on public.usage_events;
```

Efeito: o analytics de produto volta a não persistir (estado anterior). Nenhum
dado é perdido.

---

## 4. Validação executada

`supabase/tests/rls-isolation.test.ts` — 23 testes contra Postgres + RLS real,
com dois usuários e duas organizações criados de verdade, usando a mesma chave
anon do browser. **23 pass / 0 fail.** Cobre leitura, leitura por UUID conhecido,
update, delete, insert cross-tenant, auto-adição de membership, suspensão de
organização alheia, exportações, `usage_events`, `audit_logs`, forja de evento de
custo, acesso anônimo e `is_platform_admin`.

A suíte se auto-pula quando não há Supabase local acessível, para não deixar o
gate de CI vermelho onde não existe banco.

---

## 5. Dívida conhecida (não corrigida agora, deliberadamente)

| #   | Dívida                                                                                                   | Por que ficou                                                                                                                                            | Quando tratar                       |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D1  | `handle_new_user()` cria organização Free até para quem chega por convite, gerando 2 organizações        | Mudar o trigger de auth é a alteração mais arriscada possível no fluxo de cadastro. A seleção explícita de organização (M1) neutraliza o sintoma         | Antes de 10 pilotos                 |
| D2  | Sem seletor de workspace na UI, apesar de `hasMultipleOrgs` já existir                                   | Beta é single-workspace por decisão de produto                                                                                                           | Quando houver equipes               |
| D3  | Duas abstrações de rate limit (`_shared/quota.ts` e `_shared/rate-limit.ts`)                             | Semânticas diferentes: uma conta eventos de custo reais, a outra é contador antiabuso próprio. Unificar exigiria decidir o que fazer com a base de custo | Antes de cobrar                     |
| D4  | `get_quota_status` e `get_entitlements` não checam membership (confiam em serem chamadas só server-side) | Dívida preexistente e já documentada em `20260729000002_billing_foundation.sql`                                                                          | Antes de expor por RPC ao cliente   |
| D5  | `organization_invitations` permite convidar com `role = 'owner'`, e um `admin` pode fazê-lo              | Necessário para o fluxo de piloto (o convidado precisa ser owner)                                                                                        | Revisar quando houver equipes reais |

---

## 6. Riscos

| Risco                                                                        | Probabilidade | Mitigação                                                                                                         |
| ---------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Seleção de organização em `localStorage` perdida (modo privado, limpeza)     | Média         | Fallback determinístico por ordem estável; usuário permanece funcional, só pode cair na organização Free          |
| Convidado abre o link em navegador diferente daquele onde confirmou o e-mail | Média         | Token vive em `user_metadata`, não no navegador — segue funcionando                                               |
| Policy de product events estreita demais e bloqueia evento legítimo futuro   | Média         | ISO-018 falha imediatamente se a forma divergir; a policy e `track()` estão comentadas apontando uma para a outra |
| `pg_cron` ausente ⇒ `rate_limit_events` cresce sem expurgo                   | Baixa         | Migration avisa via `raise notice`; índice cobre a query mesmo com tabela grande                                  |
