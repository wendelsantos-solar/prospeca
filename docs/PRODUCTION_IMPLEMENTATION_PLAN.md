# Production Implementation Plan — Prospeca

**Data:** 2026-08-10
**Branch:** `feat/production-readiness-implementation`
**Base:** `main` (commit `b64107a`)
**Fonte:** `SAAS_READINESS_REPORT.md` + auditoria de 2026-08-10

---

## Status Legend

- `DONE` — Implementado, testado, documentado
- `PARTIALLY_DONE` — Código pronto, configuração externa pendente
- `BLOCKED_EXTERNAL_CONFIGURATION` — Depende de credencial/serviço externo
- `BLOCKED_PRODUCT_DECISION` — Precisa de decisão de produto
- `BLOCKED_TECHNICAL` — Impedimento técnico
- `NOT_STARTED` — Ainda não iniciado
- `NOT_APPLICABLE` — Não se aplica

---

## Fase 1 — Correções Críticas (P0)

| ID  | Área            | Problema                            | Prioridade | Pode implementar agora? | Dependência externa?  | Plano                                                        | Status      |
| --- | --------------- | ----------------------------------- | ---------- | ----------------------- | --------------------- | ------------------------------------------------------------ | ----------- |
| 1.1 | Observabilidade | Sem error tracking (Sentry)         | P0         | Sim                     | Sim (DSN)             | Integrar Sentry no frontend + edge functions; sem DSN = noop | NOT_STARTED |
| 1.2 | Banco           | Restore nunca testado               | P0         | Não                     | Sim (Supabase plano)  | Documentar script de teste de restore; criar checklist       | NOT_STARTED |
| 1.3 | Infraestrutura  | Staging não provisionado            | P0         | Não                     | Sim (Supabase conta)  | Documentar steps; criar checklist de provisionamento         | NOT_STARTED |
| 1.4 | Resiliência     | Rate limit fail-open                | P0         | Sim                     | Não                   | Migrar para fail-closed com alerta de degradação             | NOT_STARTED |
| 1.5 | Segurança       | Sem CSP header                      | P0         | Sim                     | Não                   | Implementar CSP header nas edge functions                    | NOT_STARTED |
| 1.6 | Segurança       | Medidor de senha enganoso           | P0         | Sim                     | Não                   | Corrigir Zod schema para validar todos os requisitos visuais | NOT_STARTED |
| 1.7 | Observabilidade | Sem alertas automatizados           | P0         | Sim                     | Sim (e-mail)          | Implementar alertas em error-digest + Sentry alerts config   | NOT_STARTED |
| 1.8 | Infraestrutura  | Sem proteção de branch + smoke test | P0         | Parcialmente            | Sim (GitHub settings) | Documentar configuração; CI já tem gates                     | NOT_STARTED |

## Fase 2 — Fundação SaaS (P0/P1)

| ID  | Área          | Problema                         | Prioridade | Pode implementar agora? | Dependência externa? | Plano                                                                         | Status      |
| --- | ------------- | -------------------------------- | ---------- | ----------------------- | -------------------- | ----------------------------------------------------------------------------- | ----------- |
| 2.1 | Billing       | Stripe não conectado             | P0         | Sim                     | Sim (Stripe keys)    | Implementar BillingProvider, StripeBillingProvider, checkout, webhook, portal | NOT_STARTED |
| 2.2 | Billing       | Entitlements não wired ao search | P1         | Sim                     | Não                  | Conectar entitlements engine ao gate de create-search                         | NOT_STARTED |
| 2.3 | Autenticação  | Sem MFA/2FA                      | P1         | Sim                     | Não                  | Implementar TOTP via Supabase Auth MFA                                        | NOT_STARTED |
| 2.4 | Segurança     | Rate limiting não uniforme       | P1         | Sim                     | Não                  | Adicionar assertRateLimit em todas edge functions públicas                    | NOT_STARTED |
| 2.5 | Segurança     | Sem CAPTCHA no cadastro          | P1         | Sim                     | Sim (Turnstile keys) | Integrar Cloudflare Turnstile no formulário de cadastro                       | NOT_STARTED |
| 2.6 | Multi-tenancy | Sem workspace switcher           | P1         | Sim                     | Não                  | Implementar seletor de workspace no UserMenu/TopNav                           | NOT_STARTED |
| 2.7 | Produto       | Entitlements visíveis ao usuário | P1         | Sim                     | Não                  | Mostrar consumo e limites no dashboard/settings                               | NOT_STARTED |

## Fase 3 — Operação de Produção (P1)

| ID  | Área            | Problema                           | Prioridade | Pode implementar agora? | Dependência externa? | Plano                                                       | Status      |
| --- | --------------- | ---------------------------------- | ---------- | ----------------------- | -------------------- | ----------------------------------------------------------- | ----------- |
| 3.1 | Observabilidade | Dashboard de métricas de produto   | P1         | Sim                     | Não                  | Criar visualização de funil no admin panel                  | NOT_STARTED |
| 3.2 | Analytics       | Analytics não validado com tráfego | P1         | Sim                     | Não                  | Adicionar testes de analytics; melhorar coverage de eventos | NOT_STARTED |
| 3.3 | Produto         | Upgrade contextual                 | P1         | Sim                     | Depende de 2.1       | Mostrar oferta de upgrade quando usuário atinge limite      | NOT_STARTED |
| 3.4 | Suporte         | Sem chat/help desk                 | P1         | Parcialmente            | Sim (vendor)         | Preparar integração com Crisp/Intercom; sem key = noop      | NOT_STARTED |
| 3.5 | E-mail          | Provider de e-mail                 | P1         | Sim                     | Sim (Resend key)     | Implementar EmailProvider; sem key = dev log                | NOT_STARTED |

## Fase 4 — Comercialização (P1)

| ID  | Área        | Problema                     | Prioridade | Pode implementar agora? | Dependência externa? | Plano                                                     | Status      |
| --- | ----------- | ---------------------------- | ---------- | ----------------------- | -------------------- | --------------------------------------------------------- | ----------- |
| 4.1 | Privacidade | CNPJ/razão social ausentes   | P1         | Parcialmente            | Sim (dados empresa)  | Adicionar campos no .env; marcar TODO visível na política | NOT_STARTED |
| 4.2 | Privacidade | Sem consentimento de cookies | P1         | Sim                     | Não                  | Implementar banner de cookies                             | NOT_STARTED |
| 4.3 | Admin       | Sem impersonação de usuário  | P2         | Sim                     | Não                  | Implementar "Login as" para platform admins               | NOT_STARTED |
| 4.4 | Admin       | Feature flags                | P2         | Sim                     | Não                  | Implementar sistema de feature flags por org/plano        | NOT_STARTED |

## Fase 5 — Qualidade e Maturidade (P2)

| ID  | Área         | Problema                      | Prioridade | Pode implementar agora? | Dependência externa? | Plano                                        | Status      |
| --- | ------------ | ----------------------------- | ---------- | ----------------------- | -------------------- | -------------------------------------------- | ----------- |
| 5.1 | Testes       | E2E fluxo real                | P2         | Sim                     | Não                  | Adicionar testes E2E do fluxo principal      | NOT_STARTED |
| 5.2 | Testes       | Sem coverage report           | P2         | Sim                     | Não                  | Configurar bun test --coverage no CI         | NOT_STARTED |
| 5.3 | Testes       | Sem axe-core (acessibilidade) | P2         | Sim                     | Não                  | Adicionar axe-core no pipeline E2E           | NOT_STARTED |
| 5.4 | Documentação | Sem OpenAPI/Swagger           | P2         | Sim                     | Não                  | Documentar edge functions em formato OpenAPI | NOT_STARTED |
| 5.5 | Performance  | Sem Lighthouse CI             | P2         | Sim                     | Não                  | Adicionar Lighthouse ao pipeline             | NOT_STARTED |
