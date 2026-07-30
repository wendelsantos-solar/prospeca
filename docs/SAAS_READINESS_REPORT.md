# SaaS Readiness Report — Radar Local

**Data:** 2026-07-30
**Avaliador:** Auditoria automatizada + revisão de código
**Objetivo:** Avaliar maturidade para beta privado com 5-10 pilotos

---

## Escala de maturidade

```text
0 — inexistente
1 — inicial ou inseguro
2 — parcialmente implementado
3 — adequado para beta privado
4 — adequado para produção comercial
5 — maduro e escalável
```

---

## Avaliação por área

### 1. Arquitetura — Nota: 3/5 ✅

**Situação atual:** Monorepo bem organizado com separação clara entre frontend
(React SPA + SSR), backend (Supabase Edge Functions), domínio puro
(packages/domain + geo) e banco (PostgreSQL + PostGIS). Padrão Repository isola
implementações reais de mocks. Módulo de entitlements já existe.

**Evidência:** `docs/ARCHITECTURE.md`, estrutura do monorepo, código limpo.

**Risco:** Baixo. A arquitetura atual é adequada para 5-50 organizações.
**Impacto:** Arquitetura suporta crescimento sem retrabalho estrutural.
**Recomendação:** Manter. Documentar pontos de escala futura (queues, cache layer).
**Prioridade:** Futuro
**Esforço:** N/A
**Dependências:** Nenhuma

---

### 2. Autenticação — Nota: 3/5 ✅

**Situação atual:** Supabase Auth implementado com signup, login, logout,
refresh token, reset de senha, e proteção de rotas. `AuthGate` no layout `/app`.

**Evidência:** `useAuth.ts`, `AuthCard.tsx`, `AuthGate` em `app.tsx`,
Supabase `config.toml` auth section.

**Risco:** Médio. `enable_confirmations = false` localmente — deve ser `true`
em produção. Sem login social.
**Impacto:** Confirmação de e-mail é básico para segurança de conta.
**Recomendação:** Habilitar `enable_confirmations` em staging/produção. Manter
login social como backlog.
**Prioridade:** Antes de 10 pilotos
**Esforço:** XS
**Dependências:** Configuração Supabase Cloud

---

### 3. Autorização — Nota: 3/5 ✅

**Situação atual:** RLS em 19+ tabelas com `is_organization_member()` +
`has_organization_role()`. Backend (`requireAuth()`) valida membership em toda
edge function. Frontend não pode bypassar.

**Evidência:** `20260719000005_rls.sql`, `supabase/functions/_shared/auth.ts`,
`move_lead_stage` RPC com verificação inline.

**Risco:** Baixo. O sistema é sólido.
**Impacto:** Proteção contra acesso cruzado já implementada.
**Recomendação:** Adicionar testes de isolamento (cross-tenant).
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Test infrastructure

---

### 4. Multi-tenancy — Nota: 3/5 ✅

**Situação atual:** Banco compartilhado com `organization_id` em todas tabelas
de negócio. RLS isola. Signup cria organização automaticamente. Modelo de
membership com roles (owner/admin/member).

**Evidência:** `organizations`, `organization_members`, schema migration,
`handle_new_user()` trigger.

**Risco:** Baixo.
**Impacto:** Isolamento lógico adequado para beta.
**Recomendação:** Adicionar `organization_invitations`. Criar testes de
isolamento. Melhorar resolução de tenant no frontend (não depender só da
primeira membership).
**Prioridade:** Antes de 10 pilotos (convites); Agora (testes de isolamento)
**Esforço:** M (convites) + M (testes)
**Dependências:** Nenhuma

---

### 5. Isolamento de dados — Nota: 3/5 ✅

**Situação atual:** RLS + `organization_id` em todas tabelas de negócio.
Backend (`requireAuth`) valida membership. `move_lead_stage` RPC verifica
`is_organization_member()` inline.

**Evidência:** `20260719000005_rls.sql`, `20260719000006_rpcs.sql`.

**Risco:** Baixo. Defesa em profundidade (RLS + backend).
**Impacto:** Vazamento entre tenants é improvável com a arquitetura atual.
**Recomendação:** Criar testes de isolamento cross-tenant (ver seção 12 do
prompt original).
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Test infrastructure

---

### 6. Segurança — Nota: 3/5 ✅

**Situação atual:** Auditoria de segurança (2026-07-23) já realizada. SSRF
protegido, secrets não expostos, RLS completo, LGPD erasure implementado.
Supressão de contatos aplicada. PII stale purgado via pg_cron.

**Evidência:** `docs/SECURITY-AUDIT-2026-07-23.md`, `docs/SECURITY.md`,
migrations de PII retention, `suppression_list`.

**Risco:** Baixo para acesso. Médio para LGPD/conformidade (em evolução).
**Impacto:** Sem vulnerabilidades críticas de acesso conhecidas.
**Recomendação:** Manter o ciclo de auditoria. Verificar rate limiting nas
edge functions. Adicionar headers de segurança (CSP, HSTS).
**Prioridade:** Antes de 10 pilotos
**Esforço:** S
**Dependências:** Configuração de infra

---

### 7. Banco e migrations — Nota: 3/5 ✅

**Situação atual:** 32 migrations ordenadas, versionadas, com foreign keys,
índices, constraints, soft delete via triggers. pg_cron para jobs.

**Evidência:** `supabase/migrations/*.sql`, `config.toml` db section.

**Risco:** Baixo para estrutura. Médio para restore (não testado).
**Impacto:** Estrutura do banco é robusta.
**Recomendação:** Documentar estratégia de backup/restore. Testar restore.
**Prioridade:** Antes de qualquer piloto
**Esforço:** S (documentação) + M (teste de restore)
**Dependências:** Acesso ao Supabase Cloud

---

### 8. Observabilidade — Nota: 2/5 ⚠️

**Situação atual:** Logs estruturados via `logEvent()` nas edge functions.
Request ID (`newRequestId()`) nas respostas de erro. Sem error tracking
externo. Sem health checks. Sem métricas de negócio agregadas (além do admin
panel).

**Evidência:** `supabase/functions/_shared/http.ts`.

**Risco:** Alto. Erros em produção podem passar despercebidos.
**Impacto:** Incapacidade de diagnosticar problemas de piloto rapidamente.
**Recomendação:** Integrar error tracking (Sentry ou equivalente). Adicionar
`/health` e `/ready` endpoints. Criar dashboard de métricas de negócio para
o beta.
**Prioridade:** Antes de qualquer piloto
**Esforço:** M (error tracking) + S (health checks)
**Dependências:** Conta Sentry ou similar, deployment config

---

### 9. Infraestrutura — Nota: 2/5 ⚠️

**Situação atual:** Supabase Cloud como plataforma. Ambientes local/staging/production
não formalmente documentados. `.env.example` existe. CI/CD via GitHub Actions
(diretório `.github/` existe, não auditado).

**Evidência:** `.env.example`, `supabase/config.toml`, `.github/`.

**Risco:** Médio. Staging não documentado. Separação de ambientes não validada.
**Impacto:** Risco de staging acessar produção ou consumir recursos reais.
**Recomendação:** Documentar ambientes formalmente. Criar `.env.example`
completo (sem secrets). Configurar CI/CD com gates (lint, typecheck, test, build).
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Configuração Supabase Cloud

---

### 10. Backups — Nota: 1/5 🔴

**Situação atual:** Supabase Cloud oferece backups automáticos (dependendo do
plano). Nenhuma documentação ou teste de restore. Estratégia de backup não
documentada.

**Evidência:** Nenhuma documentação encontrada.

**Risco:** Crítico. Perda de dados sem capacidade de restore confirmada.
**Impacto:** Catastrófico em caso de falha.
**Recomendação:** Documentar estratégia. Verificar backups automáticos do
Supabase. Testar restore. Definir RPO/RTO.
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Acesso ao Supabase Cloud, plano com backups

---

### 11. Controle de consumo — Nota: 3/5 ✅

**Situação atual:** `usage_events` + `usage_counters` + `credit_balances`.
Idempotência via `idempotency_keys`. Quotas verificadas antes de busca
(`assertSearchQuota`). Budget por organização via `set-org-budget`.

**Evidência:** `20260719000013_usage_cost_instrumentation.sql`,
`20260724000003_admin_set_budget.sql`, `supabase/functions/_shared/quota.ts`.

**Risco:** Baixo.
**Impacto:** Custos de API controlados por quota + budget.
**Recomendação:** Adicionar alertas de budget próximo do limite. Métricas de
custo visíveis ao usuário.
**Prioridade:** Antes de cobrar
**Esforço:** S
**Dependências:** Sistema de notificações/e-mail

---

### 12. Billing — Nota: 2/5 ⚠️

**Situação atual:** Fundação de billing implementada (planos, subscriptions,
entitlements). Stripe não conectado. Webhooks não implementados.

**Evidência:** `20260729000002_billing_foundation.sql`,
`docs/BILLING_ARCHITECTURE.md`, `packages/domain/src/entitlements.ts`.

**Risco:** Baixo para beta (não há cobrança ainda).
**Impacto:** Sem capacidade de cobrar. Adequado para beta gratuito.
**Recomendação:** Manter como está para beta privado. Conectar Stripe antes de
lançar planos pagos.
**Prioridade:** Antes de cobrar
**Esforço:** L (Stripe integration completa)
**Dependências:** Conta Stripe, webhooks

---

### 13. Onboarding — Nota: 1/5 🔴

**Situação atual:** Sem onboarding estruturado. Usuário cai diretamente no
produto. Signup automático cria organização e perfil.

**Evidência:** `handle_new_user()` trigger. Nenhum fluxo guiado.

**Risco:** Alto para conversão de pilotos.
**Impacto:** Pilotos podem não entender o valor do produto e abandonar.
**Recomendação:** Criar fluxo de onboarding mínimo (perfil comercial →
primeira busca → visualizar lead → adicionar ao pipeline).
**Prioridade:** Antes de 10 pilotos
**Esforço:** L
**Dependências:** Analytics de onboarding

---

### 14. Suporte — Nota: 1/5 🔴

**Situação atual:** Sem canal de suporte/feedback integrado ao produto.

**Evidência:** Nenhum componente de feedback encontrado.

**Risco:** Alto para beta.
**Impacto:** Pilotos sem canal para reportar problemas.
**Recomendação:** Criar formulário de feedback + reportar problema integrado.
Persistir no banco + notificar time interno.
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Sistema de notificações

---

### 15. Feedback — Nota: 0/5 🔴

**Situação atual:** Inexistente.

**Evidência:** Nenhum sistema encontrado.

**Risco:** Alto.
**Impacto:** Sem capacidade de coletar feedback estruturado dos pilotos.
**Recomendação:** Implementar junto com suporte. Ver seção 31 do prompt.
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Mesmo que Suporte

---

### 16. Analytics de produto — Nota: 1/5 🔴

**Situação atual:** `lib/analytics.ts` existe mas limitado. Eventos de produto
não são registrados sistematicamente.

**Evidência:** `apps/web/src/lib/analytics.ts` (arquivo existe, funcionalidade
básica).

**Risco:** Alto para validação.
**Impacto:** Incapacidade de medir ativação, retenção e conversão.
**Recomendação:** Implementar tracking de eventos de produto conforme seção 33.
**Prioridade:** Antes de 10 pilotos
**Esforço:** M
**Dependências:** Nenhuma (pode usar Supabase)

---

### 17. Administração — Nota: 2/5 ⚠️

**Situação atual:** Painel admin funcional (`/app/admin`) com visão de
organizações, consumo, custos, budget e saúde operacional. Acesso via
`is_platform_admin()` RPC.

**Evidência:** `app.admin.tsx`, `get-admin-overview` edge function,
`useIsPlatformAdmin.ts`.

**Risco:** Médio. Admin atual é focado em operações, não em gestão de pilotos.
**Impacto:** Falta visão de pilotos, onboarding status, feedback reports.
**Recomendação:** Expandir admin com gestão de pilotos (status, convites,
prorrogação, conversão).
**Prioridade:** Antes de 10 pilotos
**Esforço:** M
**Dependências:** Sistema de pilotos, convites

---

### 18. Privacidade — Nota: 2/5 ⚠️

**Situação atual:** LGPD basics implementados: erasure endpoint, retenção de
PII (90 dias stale discovery), suppression opt-out. Sem Termos de Uso ou
Política de Privacidade no produto.

**Evidência:** `delete-account-data` function, `purge_stale_discovery_pii`,
`suppression_list`, `docs/LGPD.md`.

**Risco:** Médio. Conformidade parcial.
**Impacto:** Exposição legal sem ToS/Privacy Policy.
**Recomendação:** Adicionar Termos de Uso e Política de Privacidade. Exibir
durante cadastro. Documentar retenção de dados.
**Prioridade:** Antes de qualquer piloto
**Esforço:** S (documentos legais) + XS (integração no cadastro)
**Dependências:** Revisão jurídica dos termos

---

### 19. Testes — Nota: 3/5 ✅

**Situação atual:** 69 testes passando (13 test files em apps/web + 6 em
packages/domain + 1 em packages/geo). Cobertura de lógica de domínio (score,
address, dedup, entitlements, suppression). Sem testes E2E.

**Evidência:** `bun run test` — 69 pass, 0 fail.

**Risco:** Médio. Sem testes E2E ou de isolamento cross-tenant.
**Impacto:** Regressões podem não ser detectadas.
**Recomendação:** Adicionar testes de isolamento cross-tenant. Adicionar teste
E2E do fluxo principal. Manter cobertura em evolução.
**Prioridade:** Testes de isolamento: Antes de qualquer piloto. E2E: Antes de 10 pilotos.
**Esforço:** M (isolamento) + L (E2E)
**Dependências:** Test infrastructure

---

### 20. Deploy — Nota: 2/5 ⚠️

**Situação atual:** Build funcionando. CI/CD via GitHub Actions existe mas não
auditado em detalhe. Sem health checks pós-deploy. Sem estratégia de rollback
documentada.

**Evidência:** `.github/` directory, `bun run build` funciona.

**Risco:** Médio.
**Impacto:** Deploy sem verificação pode derrubar produção.
**Recomendação:** Auditar CI/CD. Adicionar health check pós-deploy. Documentar
rollback.
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Configuração GitHub, Supabase

---

### 21. Performance — Nota: 2/5 ⚠️

**Situação atual:** Build Vite com code splitting. Paginação nas queries.
Índices adequados no banco. Sem análise de performance real.

**Evidência:** Code splitting no build output. Índices nas migrations.

**Risco:** Baixo para 5-50 orgs.
**Impacto:** Performance adequada para beta.
**Recomendação:** Monitorar. Otimizar sob demanda.
**Prioridade:** Antes de escala
**Esforço:** Variável
**Dependências:** Métricas de performance

---

### 22. Documentação — Nota: 3/5 ✅

**Situação atual:** Documentação extensa: arquitetura, billing, segurança,
LGPD, database, deployment, planos, cleanup reports, ADR. ~30 documentos.

**Evidência:** `docs/` directory com 30+ arquivos.

**Risco:** Baixo.
**Impacto:** Boa base de conhecimento.
**Recomendação:** Adicionar docs faltantes (backup, ambientes, runbooks,
checklists de beta).
**Prioridade:** Antes de qualquer piloto
**Esforço:** M
**Dependências:** Nenhuma

---

## Resumo

| Área                 | Nota | Status                     |
| -------------------- | ---- | -------------------------- |
| Arquitetura          | 3    | ✅                         |
| Autenticação         | 3    | ✅                         |
| Autorização          | 3    | ✅                         |
| Multi-tenancy        | 3    | ✅                         |
| Isolamento de dados  | 3    | ✅                         |
| Segurança            | 3    | ✅                         |
| Banco e migrations   | 3    | ✅                         |
| Observabilidade      | 2    | ⚠️ Precisa melhorar        |
| Infraestrutura       | 2    | ⚠️ Precisa documentar      |
| Backups              | 1    | 🔴 Crítico                 |
| Controle de consumo  | 3    | ✅                         |
| Billing              | 2    | ⚠️ Fundação pronta         |
| Onboarding           | 1    | 🔴 Precisa implementar     |
| Suporte              | 1    | 🔴 Precisa implementar     |
| Feedback             | 0    | 🔴 Inexistente             |
| Analytics de produto | 1    | 🔴 Precisa implementar     |
| Administração        | 2    | ⚠️ Precisa expandir        |
| Privacidade          | 2    | ⚠️ Precisa ToS/PP          |
| Testes               | 3    | ✅ (faltam E2E/isolamento) |
| Deploy               | 2    | ⚠️ Precisa health checks   |
| Performance          | 2    | ⚠️                         |
| Documentação         | 3    | ✅                         |

**Média geral:** 2.2/5 — adequado para MVP interno, precisa de investimento
focado para beta privado.

**Classificação final:** PRONTO COM RESSALVAS para beta privado com 5-10 pilotos,
após correção dos itens críticos identificados.

---

# Revisão 2 — 2026-07-30 (pós-correções)

> As notas acima são o retrato **pré-implementação**. Foram mantidas como
> histórico. As notas abaixo reavaliam cada área contra o código verificado após
> os commits `c508d40`/`3757b45` **e** as correções desta sessão.
>
> Regra aplicada: onde a funcionalidade existia mas estava **inerte**, a nota não
> subiu por existir — subiu só depois de funcionar e, quando possível, de ter
> teste. Ver `docs/SAAS_BASELINE.md` §5 para a auditoria de evidência.

| Área                 | Nota (rev 1) | Nota (rev 2) | Evidência da mudança                                                                                                          |
| -------------------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Arquitetura          | 3            | 3            | Sem mudança estrutural                                                                                                        |
| Autenticação         | 3            | 3            | Sem mudança                                                                                                                   |
| Autorização          | 3            | **4**        | `is_platform_admin()` + RLS comprovados por teste (ISO-011/023)                                                               |
| Multi-tenancy        | 3            | **4**        | Resolução de tenant agora determinística e centralizada em `lib/tenant.ts`                                                    |
| Isolamento de dados  | 3            | **4**        | 23 testes reais contra Postgres + RLS, 23 pass (`supabase/tests/rls-isolation.test.ts`)                                       |
| Segurança            | 3            | 3            | 2 achados S3 corrigidos (S3-04, S3-05), mas error tracking segue ausente                                                      |
| Banco e migrations   | 3            | 3            | 2 migrations aditivas validadas em local; ainda sem staging                                                                   |
| Observabilidade      | 2            | 2            | Logs estruturados + request ID + health check ok; **error tracking e alertas seguem em 0**                                    |
| Infraestrutura       | 2            | 2            | `ENVIRONMENTS.md` existe; staging não provisionado                                                                            |
| Backups              | 1            | 1            | Documentado, restore **nunca testado** — nota não sobe por documentação                                                       |
| Controle de consumo  | 3            | **4**        | Quota + budget já existiam; rate limit antiabuso deixou de ser inerte (S3-04)                                                 |
| Billing              | 2            | 2            | Fundação + plano Pilot; sem cobrança (não bloqueia beta)                                                                      |
| Onboarding           | 1            | **3**        | `OnboardingWizard` + `useOnboarding` retomável, integrado ao `AppLayout`                                                      |
| Suporte              | 1            | **3**        | `FeedbackForm` no produto + `submit-feedback`                                                                                 |
| Feedback             | 0            | **3**        | Tabela `feedback` + edge function + RLS                                                                                       |
| Analytics de produto | 1            | **2**        | Corrigido de "não persistia nada" para funcional (policy + contexto). Só 2 porque **ainda não foi validado com tráfego real** |
| Administração        | 2            | **3**        | `PilotManagement.tsx` + `create-pilot` com autorização e auditoria                                                            |
| Privacidade          | 2            | **3**        | ToS + Política + `TermsGate` no cadastro; sem revisão jurídica                                                                |
| Testes               | 3            | **4**        | 225 pass / 0 fail; isolamento real coberto. E2E ainda não executável                                                          |
| Deploy               | 2            | 2            | Health check entregue; **sem CI com gates**                                                                                   |
| Performance          | 2            | 2            | Sem mudança; adequado para 5–50 organizações                                                                                  |
| Documentação         | 3            | **4**        | `SAAS_BASELINE.md` e `MULTI_TENANCY_MIGRATION_PLAN.md` criados; checklist e security audit corrigidos                         |

**Média geral: 3.0/5** (era 2.2). Adequado para **beta privado controlado**, ainda
não para cobrança.

**Áreas que continuam abaixo de 3 e por quê:**

| Área                 | Nota | Único motivo de estar baixa                               |
| -------------------- | ---- | --------------------------------------------------------- |
| Observabilidade      | 2    | Error tracking ausente — falha de piloto real é invisível |
| Backups              | 1    | Restore nunca executado                                   |
| Infraestrutura       | 2    | Staging não provisionado                                  |
| Deploy               | 2    | Sem CI com gates de lint/typecheck/test/build             |
| Analytics de produto | 2    | Corrigido mas não validado com uso real                   |
| Billing              | 2    | Deliberado — não bloqueia beta gratuito                   |
| Performance          | 2    | Deliberado — suficiente para a escala do beta             |

Quatro dos sete itens (observabilidade, backups, infraestrutura, deploy) são
**operacionais e não de produto**, e são exatamente os bloqueadores B1–B4 do
`PRIVATE_BETA_READINESS_CHECKLIST.md`.

**Classificação final (rev 2):** **PRONTO PARA BETA PRIVADO CONTROLADO** com os
4 bloqueadores operacionais tratados — dois deles (error tracking, CI) de esforço
pequeno.
