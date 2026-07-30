# SaaS Baseline — Radar Local

**Data:** 2026-07-30
**Objetivo:** Registrar o estado verificável do projeto ANTES das correções desta
sessão, para que nenhum erro preexistente seja atribuído às mudanças novas — e
para que nenhuma correção nova seja creditada sem evidência.

Este documento é o que faltava do §4 do plano de readiness: as duas primeiras
entregas desta branch (`c508d40`, `3757b45`) foram feitas sem ele, então o
baseline abaixo foi reconstruído a posteriori, medindo o commit `3757b45`.

---

## 1. Git

| Item                       | Valor                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Branch de origem           | `main`                                                                                      |
| Branch de trabalho         | `feat/saas-production-readiness`                                                            |
| Commit medido (baseline)   | `3757b45` — "feat: modal de feedback"                                                       |
| Commit anterior relevante  | `c508d40` — "feat: SaaS production readiness — multi-tenancy, security, onboarding, pilots" |
| Base comum com `main`      | `171f1c8` — "docs(ds-v2): add next-steps roadmap"                                           |
| Commits à frente de `main` | 2                                                                                           |
| Working tree no início     | **limpo** (sem arquivos modificados nem não rastreados)                                     |

Observação importante: a branch do Design System V2 (`171f1c8` e anteriores) já
está mergeada na base desta branch — não há mistura de trabalho visual novo aqui.

---

## 2. Stack (verificada em `package.json`)

| Camada          | Tecnologia                                                   |
| --------------- | ------------------------------------------------------------ |
| Monorepo        | Bun workspaces + Turborepo 2.10.5                            |
| Package manager | `bun@1.3.14` (`bunfig.toml` com `minimumReleaseAge = 86400`) |
| Frontend        | React 19.2, Vite 8.0, TanStack Router 1.170, Tailwind 4.2    |
| Linguagem       | TypeScript 5.8 (`strict: true`)                              |
| Backend         | Supabase Edge Functions (Deno)                               |
| Banco           | Postgres (Supabase) + PostGIS + pg_cron                      |
| Cliente DB      | `@supabase/supabase-js` 2.110                                |
| Testes          | `bun test` (runner nativo)                                   |
| E2E             | Playwright — **não instalado** (ver §5)                      |

### Estrutura

```
apps/web/                 frontend (React + TanStack Router)
packages/domain/          regras puras: scoring, entitlements
packages/geo/             utilidades geográficas
supabase/functions/       21 edge functions + _shared/
supabase/migrations/      37 migrations
supabase/tests/           testes de RLS (criado nesta sessão)
docs/                     documentação
```

---

## 3. Resultado dos gates no baseline (`3757b45`)

Comandos executados na raiz do repositório.

| Gate      | Comando             | Resultado no baseline                     |
| --------- | ------------------- | ----------------------------------------- |
| Typecheck | `bun run typecheck` | ✅ **passou** — 3 pacotes                 |
| Build     | `bun run build`     | ✅ **passou** — build em ~770ms           |
| Lint      | `bun run lint`      | ❌ **falhou** — 12 erros + 1 warning      |
| Testes    | `bun test`          | ❌ **falhou** — 202 pass, 1 fail, 1 error |

### 3.1 Erros de lint preexistentes (não causados pelas correções)

Todos em `@leads/web`, todos `prettier/prettier` (formatação):

- `apps/web/src/components/app/FeedbackForm.tsx` — 11 erros de formatação
- `apps/web/src/components/app/SearchForm.tsx` — 1 erro de formatação
- `apps/web/src/routes/cadastro.tsx:66` — warning `react-hooks/exhaustive-deps`
  (dependência `plan` ausente)

Origem: commit `3757b45` (o modal de feedback) foi entregue sem passar o lint.

### 3.2 Falha de teste preexistente

```
error: Cannot find module '@playwright/test' from
'/home/wendelsantos/works/leads/apps/web/e2e/isolation.spec.ts'
```

Causa: `apps/web/e2e/isolation.spec.ts` foi escrito no commit `c508d40` usando
Playwright, mas `@playwright/test` nunca foi adicionado ao projeto. Pior: o nome
`*.spec.ts` cai no matcher do `bun test`, que varre o monorepo inteiro — então um
arquivo E2E que nunca poderia rodar quebrava o gate de testes unitários.

---

## 4. Migrations

- 37 migrations em `supabase/migrations/`.
- No banco local, as 35 primeiras estavam aplicadas; nenhuma pendência de drift
  detectada via `supabase migration list --local`.
- Numeração tem um salto: não existe `20260729000003` (entre
  `20260729000002_billing_foundation` e `20260729000004_landing_marketing`).
  Cosmético, sem impacto — mas registrado para não parecer migration perdida.

---

## 5. Estado real das entregas anteriores (auditoria de evidência)

O commit `c508d40` declara várias entregas. Auditando o código, parte delas
estava incompleta ou inerte. Isto é baseline, não regressão:

| Declarado em `c508d40`                                                        | Estado real medido                                                                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Rate limiting centralizado (`_shared/rate-limit.ts`)"                        | ❌ **Inerte** — gravava em `usage_events` com `event_type='rate_limit_*'`, violando o CHECK da coluna; erro não verificado ⇒ contador nunca incrementava ⇒ limite nunca disparava |
| "Testes de isolamento cross-tenant (`packages/domain/src/isolation.test.ts`)" | ❌ **Não testa isolamento** — só funções puras de entitlement com 2 objetos em memória; zero banco, zero RLS, zero acesso cruzado                                                 |
| "Hook `useTenant()` centralizado (`lib/tenant.ts`)"                           | ❌ **Código morto** — nenhum consumidor; os repositories continuavam com `select("organization_id").limit(1)` sem `ORDER BY`                                                      |
| "Edge function accept-invitation"                                             | ⚠️ **Existe mas nunca era chamada** — nenhum código de frontend invocava; o token só era guardado em `user_metadata`                                                              |
| "Tabela `organization_invitations` com RLS"                                   | ✅ Confirmado                                                                                                                                                                     |
| "Edge function health-check (/health, /ready)"                                | ✅ Confirmado (existe)                                                                                                                                                            |
| "Tabela feedback + plano Pilot"                                               | ✅ Confirmado                                                                                                                                                                     |
| "Headers de segurança"                                                        | ✅ Confirmado em `_shared/http.ts`                                                                                                                                                |
| Analytics de produto (`lib/analytics.ts`)                                     | ❌ **Nunca persistia** — `usage_events` tem RLS só com policy de SELECT; todo INSERT do cliente era rejeitado e o erro engolido                                                   |

Documentos declarados como criados (`docs/SAAS_*` etc.) existem, **exceto**:

- `docs/SAAS_BASELINE.md` (este arquivo) — não existia
- `docs/MULTI_TENANCY_MIGRATION_PLAN.md` — não existia

E `docs/PRIVATE_BETA_READINESS_CHECKLIST.md` estava congelado no estado
PRÉ-implementação: marcava como pendentes itens já entregues (health check,
convites, plano Pilot, feedback, Termos/Privacidade) e concluía "NÃO PRONTO PARA
PILOTOS" com base em dados vencidos.

---

## 6. Riscos iniciais identificados no baseline

| #   | Risco                                                                          | Severidade                     |
| --- | ------------------------------------------------------------------------------ | ------------------------------ |
| R1  | Rate limiting inerte — proteção antiabuso e de custo declarada mas ausente     | Alto                           |
| R2  | Analytics de produto não persistia — beta sem capacidade de medir ativação     | Alto (para o objetivo do beta) |
| R3  | Fluxo de convite não fechava — piloto convidado nunca entrava na org do piloto | Alto                           |
| R4  | Resolução de tenant não determinística com 2+ organizações                     | Alto                           |
| R5  | Isolamento cross-tenant sem cobertura real de teste                            | Alto                           |
| R6  | Gate de CI vermelho (lint + testes) — regressão futura passa despercebida      | Médio                          |
| R7  | E2E declarado, impossível de executar                                          | Médio                          |
| R8  | `organizations.owner_user_id` do piloto ficava com o admin da plataforma       | Baixo (não usado em RLS)       |

---

## 7. Como reproduzir este baseline

```bash
git checkout 3757b45
bun install
bun run typecheck   # passa
bun run build       # passa
bun run lint        # falha: 12 erros prettier
bun test            # falha: 1 fail (@playwright/test ausente)
```

Para o banco local (necessário para os testes de RLS):

```bash
supabase start
supabase migration up --local
bun test supabase/tests/rls-isolation.test.ts
```
