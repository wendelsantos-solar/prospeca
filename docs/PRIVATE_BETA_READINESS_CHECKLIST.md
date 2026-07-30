# Private Beta Readiness Checklist — Radar Local

**Data:** 2026-07-30 (revisão 2 — pós-correções)
**Objetivo:** Checklist objetivo de itens obrigatórios antes de convidar o primeiro piloto.

> **Revisão 2.** A revisão 1 deste arquivo era o retrato PRÉ-implementação: marcava
> como pendentes itens já entregues nos commits `c508d40`/`3757b45` (health check,
> convites, plano Pilot, feedback, Termos/Privacidade) e concluía "NÃO PRONTO PARA
> PILOTOS" com dados vencidos. Cada linha abaixo foi reverificada no código. Onde
> a entrega existia mas estava **inerte**, o status registra isso — declarar
> pronto o que não funciona é pior que declarar pendente.

---

## Legenda

- ✅ Pronto — verificado no código
- ⚠️ Parcial / precisa de atenção
- ❌ Pendente
- 🔧 Corrigido nesta sessão (estava inerte ou incompleto)

---

## Gate 1: Infraestrutura básica

| #   | Item                               | Status | Evidência                                                                                                                                       | Bloqueador? |
| --- | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Login e recuperação de senha       | ✅     | `hooks/useAuth.ts`, rotas `/login`, `/recuperar-senha`, `/redefinir-senha`                                                                      | -           |
| 2   | Staging funcional                  | ❌     | `docs/ENVIRONMENTS.md` documenta o modelo, mas não há projeto Supabase de staging provisionado                                                  | **Sim**     |
| 3   | Produção funcional                 | ✅     | Supabase Cloud + deploy de edge functions                                                                                                       | -           |
| 4   | Migrations testadas                | ⚠️     | 39 migrations; as 2 novas aplicadas e validadas em banco local (`supabase migration up --local`). Sem staging, não há teste em ambiente espelho | **Sim**     |
| 5   | Backup configurado                 | ⚠️     | Supabase gerencia PITR no plano pago; `docs/BACKUP_AND_RECOVERY.md` documenta a estratégia                                                      | **Sim**     |
| 6   | Restore testado                    | ❌     | Documentado, **nunca executado**. Backup sem restore testado não conta                                                                          | **Sim**     |
| 7   | Health check                       | ✅     | `supabase/functions/health-check/index.ts` (`/health`, `/ready`)                                                                                | -           |
| 8   | Variáveis de ambiente documentadas | ✅     | `.env.example` + `docs/ENVIRONMENTS.md`                                                                                                         | -           |

---

## Gate 2: Segurança e isolamento

| #   | Item                                 | Status | Evidência                                                                                                                                                                                                                                                                                                                       | Bloqueador? |
| --- | ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 9   | Organização criada no signup         | ✅     | trigger `handle_new_user()` (`20260729000002`)                                                                                                                                                                                                                                                                                  | -           |
| 10  | Isolamento entre tenants **testado** | 🔧 ✅  | `supabase/tests/rls-isolation.test.ts` — **23 testes, 23 pass**, contra Postgres + RLS real, 2 usuários e 2 organizações reais, chave anon. Antes: `packages/domain/src/isolation.test.ts` só testava entitlement em memória, sem banco                                                                                         | -           |
| 11  | Rotas administrativas protegidas     | ✅     | `is_platform_admin()` (`20260724000005`) + checagem em `create-pilot`/`get-admin-overview`; ISO-023 confirma que usuário comum recebe `false`                                                                                                                                                                                   | -           |
| 12  | Limites de consumo ativos            | ✅     | `assertSearchQuota()` + `get_quota_status` + budget por organização                                                                                                                                                                                                                                                             | -           |
| 13  | Custos externos protegidos           | ✅     | `set-org-budget` + gate de budget no `execute-search` + cache de provider (TTL 30d)                                                                                                                                                                                                                                             | -           |
| 14  | Secrets não expostos                 | ✅     | Auditado 2026-07-23; service role só em edge functions                                                                                                                                                                                                                                                                          | -           |
| 15  | Rate limiting ativo                  | 🔧 ✅  | **Estava inerte**: `_shared/rate-limit.ts` gravava em `usage_events` com `event_type='rate_limit_*'`, violando o CHECK da coluna, erro não verificado ⇒ contador sempre 0 ⇒ limite nunca disparava. Bug reproduzido em banco local. Corrigido com `rate_limit_events` (`20260730000004`) + escopo por usuário + erro verificado | -           |
| 16  | RLS nas tabelas de negócio           | ✅     | `20260719000005_rls.sql` — 17 tabelas; confirmado por teste                                                                                                                                                                                                                                                                     | -           |
| 17  | CORS configurado                     | ✅     | `getCorsHeaders()` em `_shared/http.ts`                                                                                                                                                                                                                                                                                         | -           |
| 18  | Cliente não escreve na base de custo | 🔧 ✅  | Policy `usage_events_product_insert` (`20260730000005`) aceita só evento de produto; ISO-017 prova que forja de evento de custo é barrada                                                                                                                                                                                       | -           |

---

## Gate 3: Observabilidade

| #   | Item                               | Status | Evidência                                                                                                                        | Bloqueador? |
| --- | ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 19  | Error tracking (Sentry ou similar) | ❌     | Nenhuma integração. `.env.example` reserva as chaves, nada consome                                                               | **Sim**     |
| 20  | Logs com request ID                | ✅     | `newRequestId()` + `logEvent()` nas edge functions                                                                               | -           |
| 21  | Logs estruturados (JSON)           | ✅     | `logEvent()`; `rate-limit.ts` emite `rate_limit_degraded` em JSON                                                                | -           |
| 22  | Alertas de erro crítico            | ❌     | Sem sistema de alerta                                                                                                            | Não         |
| 23  | Audit logs em ações críticas       | ⚠️     | `audit_logs` + `writeAudit()`; cobre busca, exportação, piloto criado, convite aceito. Não cobre alteração de role nem de limite | Não         |

---

## Gate 4: Pilotos

| #   | Item                                  | Status | Evidência                                                                                                                                                                                                                                                                              | Bloqueador? |
| --- | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 24  | Plano Pilot configurado               | ✅     | `billing_plans` code `pilot` (`20260730000002`): 60 buscas/mês, 1.000 leads, `is_public: false`                                                                                                                                                                                        | -           |
| 25  | Convite criado                        | ✅     | `organization_invitations` (`20260730000001`) + `create-pilot`; token SHA-256, expiração, uso único, índice parcial de unicidade                                                                                                                                                       | -           |
| 26  | Convite **consumido** (ponta a ponta) | 🔧 ✅  | **Estava quebrado**: `accept-invitation` existia e estava deployada, mas nenhum código de frontend a chamava — o convidado ficava só na organização Free automática. Corrigido em `hooks/usePendingInvitation.ts`                                                                      | -           |
| 27  | Handoff de propriedade do piloto      | 🔧 ✅  | `create-pilot` deixava `owner_user_id` = admin da plataforma para sempre. `accept-invitation` agora transfere e avança `pilot_status` para `onboarding`. (Não era vazamento: `owner_user_id` não aparece em nenhuma policy)                                                            | -           |
| 28  | Onboarding mínimo                     | ✅     | `OnboardingWizard` + `useOnboarding` (retomável, progresso salvo), integrado ao `AppLayout`                                                                                                                                                                                            | Não         |
| 29  | Analytics de ativação                 | 🔧 ⚠️  | **Não persistia nada**: `usage_events` tinha RLS só com policy de SELECT ⇒ todo INSERT do cliente era rejeitado e o erro engolido; e `setAnalyticsContext()` nunca era chamado. Corrigido (policy + contexto no `AppLayout` + erro visível). Falta validar os eventos com tráfego real | Não         |
| 30  | Tela admin de pilotos                 | ✅     | `components/app/PilotManagement.tsx` no painel admin                                                                                                                                                                                                                                   | Não         |

---

## Gate 5: Suporte e feedback

| #   | Item                            | Status | Evidência                                                          | Bloqueador? |
| --- | ------------------------------- | ------ | ------------------------------------------------------------------ | ----------- |
| 31  | Canal de suporte no produto     | ✅     | `components/app/FeedbackForm.tsx`                                  | -           |
| 32  | Feedback persistido             | ✅     | tabela `feedback` (`20260730000002`) + `submit-feedback`           | -           |
| 33  | Notificação de feedback ao time | ⚠️     | `_shared/email.ts` existe; depende de `RESEND_API_KEY` configurada | Não         |

---

## Gate 6: Legal e privacidade

| #   | Item                         | Status | Evidência                                                | Bloqueador?                 |
| --- | ---------------------------- | ------ | -------------------------------------------------------- | --------------------------- |
| 34  | Exclusão de conta            | ✅     | `delete-account-data` edge function                      | -                           |
| 35  | Política de Privacidade      | ✅     | `routes/privacidade.tsx`                                 | -                           |
| 36  | Termos de Uso                | ✅     | `routes/termos.tsx`                                      | -                           |
| 37  | Aceite de ToS/PP no cadastro | ✅     | `components/auth/TermsGate.tsx` em `cadastro.tsx`        | -                           |
| 38  | Retenção de dados            | ✅     | `purge_stale_discovery_pii` (90d) + suppression list     | -                           |
| 39  | Revisão jurídica dos textos  | ❌     | Textos escritos por engenharia, sem revisão profissional | Não (mas registrar o risco) |

---

## Gate 7: Qualidade

| #   | Item                                | Status | Evidência                                                                                                                                                                                                                                                                                                                                       | Bloqueador? |
| --- | ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 40  | Lint passando                       | 🔧 ✅  | Estava com 12 erros prettier + 1 warning no baseline. `bun run lint` limpo                                                                                                                                                                                                                                                                      | -           |
| 41  | Typecheck passando                  | ✅     | `bun run typecheck` — 3 pacotes                                                                                                                                                                                                                                                                                                                 | -           |
| 42  | Build passando                      | ✅     | `bun run build`                                                                                                                                                                                                                                                                                                                                 | -           |
| 43  | Testes unitários                    | 🔧 ✅  | Estava 202 pass / 1 fail. Agora **225 pass / 0 fail** (26 arquivos)                                                                                                                                                                                                                                                                             | -           |
| 44  | `deno check` nas edge functions     | ✅     | Executado nas funções alteradas; não está no gate automatizado                                                                                                                                                                                                                                                                                  | Não         |
| 45  | E2E do fluxo principal              | ❌     | `apps/web/e2e/isolation.e2e.ts` + `playwright.config.ts` existem, mas `@playwright/test` **não está instalado** — não roda. Renomeado de `.spec.ts` para `.e2e.ts` para parar de quebrar o `bun test`                                                                                                                                           | Não         |
| 46  | CI/CD com gates                     | 🔧 ✅  | **Correção de uma afirmação errada da revisão 2:** o workflow `.github/workflows/ci.yml` já existia (7 gates, roda em PR). O problema era outro — estava **vermelho desde antes desta branch**: `format:check` falhava e `deno lint` acusava 26 problemas. CI vermelha não gateia nada, ela ensina o time a ignorar CI. Agora os 7 gates passam | -           |
| 47  | Fluxo principal validado em staging | ❌     | Depende do item 2                                                                                                                                                                                                                                                                                                                               | Não         |

---

## Resumo

| Gate                   | Total  | ✅     | ⚠️    | ❌    |
| ---------------------- | ------ | ------ | ----- | ----- |
| Infraestrutura         | 8      | 4      | 2     | 2     |
| Segurança e isolamento | 10     | 10     | 0     | 0     |
| Observabilidade        | 5      | 2      | 1     | 2     |
| Pilotos                | 7      | 6      | 1     | 0     |
| Suporte                | 3      | 2      | 1     | 0     |
| Legal                  | 6      | 5      | 0     | 1     |
| Qualidade              | 8      | 5      | 0     | 3     |
| **Total**              | **47** | **34** | **5** | **8** |

**72% pronto** (34/47), contra 45% na revisão 1 — sendo que 6 dos itens agora
verdes estavam declarados prontos mas **inertes**, e não teriam funcionado em
produção.

---

## Bloqueadores remanescentes antes do primeiro piloto

| #      | Bloqueador       | Esforço | Por que bloqueia                                                                                                                                                                                                                          |
| ------ | ---------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1     | Error tracking   | S       | Sem isto, erro de piloto real é invisível. Todo o valor do beta é aprender com uso real. **Precisa de decisão:** Sentry (SaaS, DSN + nova dependência) ou tabela própria no Postgres (sem vendor, já dá para correlacionar por requestId) |
| B2     | Staging separado | M       | Migration e deploy hoje vão de local para produção sem ambiente espelho. **Precisa de acesso:** criar o projeto Supabase de staging                                                                                                       |
| B3     | Restore testado  | S       | `BACKUP_AND_RECOVERY.md` descreve o processo; ninguém executou. **Precisa de acesso:** PITR exige plano pago do Supabase                                                                                                                  |
| ~~B4~~ | ~~CI com gates~~ | —       | **Resolvido.** A CI existia e estava vermelha desde antes desta branch (`format:check` falhando, `deno lint` com 26 problemas). Os 7 gates agora passam                                                                                   |

Não bloqueiam: E2E automatizado, alertas, revisão jurídica, seletor de workspace,
billing completo.

**Proteção de branch** (`main` exigindo CI verde antes de merge) não é verificável
a partir do repositório — é configuração do GitHub. Com a CI finalmente verde,
ligar essa proteção é o que transforma os 7 gates em gate de verdade.

---

## Classificação

**PRONTO PARA PILOTOS COM BLOQUEADORES.**

O isolamento multi-tenant está verificado por teste real (23/23), os 7 gates de
CI estão verdes pela primeira vez, e os 3 defeitos funcionais que impediriam um
piloto de existir (convite não consumido, rate limit inerte, analytics não
persistindo) estão corrigidos.

O que falta é **operacional**, não de produto: enxergar erro (B1), ter onde
ensaiar mudança (B2) e saber restaurar (B3). Os três dependem de decisão de
vendor ou de acesso a conta — não de código.

### A lição que o baseline deixou registrada

Os defeitos desta rodada não foram de arquitetura. Foram de **verificação**:
controles escritos, documentados como prontos e nunca exercitados. A CI vermelha
é a causa raiz de todos eles — um gate que sempre falha não distingue código bom
de ruim, então para de ser lido. Manter os 7 gates verdes e exigi-los no merge
vale mais, daqui para frente, que qualquer controle novo.
