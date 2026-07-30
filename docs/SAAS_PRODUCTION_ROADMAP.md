# SaaS Production Roadmap — Radar Local

**Data:** 2026-07-30
**Branch:** `feat/saas-production-readiness`

---

## Priorização

### Impacto
- 🔴 **Crítico:** Bloqueia beta privado ou causa dano irreversível
- 🟠 **Alto:** Essencial para qualidade do beta
- 🟡 **Médio:** Importante mas não bloqueia
- 🟢 **Baixo:** Desejável, pode esperar

### Urgência
- 🚫 **Blocker:** Antes de qualquer piloto
- 1️⃣ **P1:** Antes de 10 pilotos
- 💰 **P2:** Antes de cobrar
- 📈 **P3:** Antes de escala (>50 orgs)
- 🔮 **Futuro:** Backlog

### Esforço
- **XS:** Horas
- **S:** 1-2 dias
- **M:** 3-5 dias
- **L:** 1-2 semanas
- **XL:** >2 semanas

---

## Fase 0 — Baseline ✅

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 0.1 | Criar branch `feat/saas-production-readiness` | - | XS | ✅ |
| 0.2 | Executar baseline (lint, typecheck, build, test) | - | XS | ✅ (69 pass) |
| 0.3 | Auditoria de arquitetura | - | S | ✅ |
| 0.4 | Relatório de maturidade | - | M | ✅ |

---

## Fase 1 — Segurança Crítica 🚫

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 1.1 | Corrigir formatação lint (Prettier) | 🟢 | XS | ✅ |
| 1.2 | Criar `SECURITY_AUDIT.md` atualizado | 🟠 | S | Em progresso |
| 1.3 | Testes de isolamento cross-tenant | 🔴 | M | Pendente |
| 1.4 | Rate limiting nas edge functions públicas | 🟠 | S | Parcial (quota.ts) |
| 1.5 | Headers de segurança (CSP, HSTS) | 🟡 | S | Pendente |
| 1.6 | Validar env de secrets (sem hardcode) | 🔴 | XS | ✅ (já validado) |

---

## Fase 2 — Multi-Tenancy Foundation 🚫

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 2.1 | `organization_invitations` table + migration | 🟠 | M | Pendente |
| 2.2 | `accept-invitation` edge function | 🟠 | M | Pendente |
| 2.3 | `TenantContext` hook centralizado no frontend | 🟠 | M | Pendente |
| 2.4 | Testes de isolamento cross-tenant | 🔴 | M | Pendente |
| 2.5 | Melhorar resolução de org (não só primeira membership) | 🟡 | S | Pendente |

---

## Fase 3 — Produção 🚫

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 3.1 | Documentar ambientes (`ENVIRONMENTS.md`) | 🟠 | S | Pendente |
| 3.2 | Atualizar `.env.example` completo | 🟠 | XS | Pendente |
| 3.3 | Auditar CI/CD (`.github/`) | 🟠 | S | Pendente |
| 3.4 | Health check endpoints (`/health`, `/ready`) | 🟠 | M | Pendente |
| 3.5 | Documentar backup/restore (`BACKUP_AND_RECOVERY.md`) | 🔴 | M | Pendente |
| 3.6 | Documentar estratégia de rollback | 🟠 | S | Pendente |

---

## Fase 4 — Observabilidade 🚫

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 4.1 | Request ID em todas edge functions (já existe parcial) | 🟠 | XS | ✅ |
| 4.2 | Correlation ID entre frontend e backend | 🟡 | S | Pendente |
| 4.3 | Error tracking (Sentry ou similar) | 🔴 | M | Pendente |
| 4.4 | Health checks com dependências | 🟠 | S | Pendente |
| 4.5 | Audit log em ações críticas | 🟠 | M | Parcial |
| 4.6 | Documentar observabilidade (`OBSERVABILITY.md`) | 🟠 | S | Pendente |

---

## Fase 5 — Controle do Produto 1️⃣

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 5.1 | Feature flags centralizadas | 🟡 | M | Pendente |
| 5.2 | Conectar entitlements ao create-search | 🟠 | S | Pendente |
| 5.3 | Limites visíveis ao usuário (usage dashboard) | 🟡 | M | Pendente |
| 5.4 | Alertas de limite próximo (budget/cota) | 🟡 | M | Pendente |

---

## Fase 6 — Beta Privado 1️⃣

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 6.1 | Plano Pilot (configurável, não hardcoded) | 🟠 | M | Pendente |
| 6.2 | Convite de piloto (admin cria, envia, acompanha) | 🟠 | L | Pendente |
| 6.3 | Tela admin de gestão de pilotos | 🟠 | M | Pendente |
| 6.4 | Expiração e prorrogação de piloto | 🟠 | M | Pendente |
| 6.5 | Conversão de piloto → plano | 💰 | M | Pendente |
| 6.6 | Documentar programa piloto (`PILOT_PROGRAM.md`) | 🟠 | S | Pendente |

---

## Fase 7 — Onboarding e Ativação 1️⃣

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 7.1 | Perfil comercial (o que vende, região, equipe) | 🟠 | M | Pendente |
| 7.2 | Fluxo de onboarding guiado | 🟠 | L | Pendente |
| 7.3 | Eventos de progresso de onboarding | 🟠 | M | Pendente |
| 7.4 | Retomada de onboarding | 🟡 | S | Pendente |
| 7.5 | Analytics de ativação | 🟠 | M | Pendente |
| 7.6 | Documentar modelo de ativação (`PRODUCT_ACTIVATION_MODEL.md`) | 🟠 | S | Pendente |

---

## Fase 8 — Suporte, Feedback e Privacidade 1️⃣

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 8.1 | Formulário de feedback no produto | 🟠 | M | Pendente |
| 8.2 | Formulário de reportar problema | 🟠 | M | Pendente |
| 8.3 | Persistência de feedback no banco | 🟠 | S | Pendente |
| 8.4 | Notificação de feedback (e-mail/Linear) | 🟡 | S | Pendente |
| 8.5 | Termos de Uso + Política de Privacidade | 🔴 | S | Pendente |
| 8.6 | Checkbox ToS/PP no cadastro | 🔴 | XS | Pendente |
| 8.7 | Documentar privacidade (`DATA_PRIVACY_AND_RETENTION.md`) | 🟠 | S | Pendente |

---

## Fase 9 — Consolidação 💰

| # | Item | Impacto | Esforço | Status |
|---|------|---------|---------|--------|
| 9.1 | Testes E2E (fluxo do piloto) | 🟠 | L | Pendente |
| 9.2 | Testes de isolamento cross-tenant | 🔴 | M | Pendente |
| 9.3 | Documentação final e runbooks | 🟠 | M | Pendente |
| 9.4 | Validar todos os gates do checklist de beta | 🔴 | M | Pendente |

---

## Itens para depois do beta (💰 / 📈)

| # | Item | Quando |
|---|------|--------|
| B.1 | Stripe integration completa | Antes de cobrar |
| B.2 | Webhooks de billing | Antes de cobrar |
| B.3 | Portal de cobrança (Stripe Customer Portal) | Antes de cobrar |
| B.4 | Upgrade/downgrade de plano | Antes de cobrar |
| B.5 | E-mails transacionais (convite, boas-vindas, fatura) | Antes de cobrar |
| B.6 | Login social (Google) | Antes de escala |
| B.7 | Seletor de workspace (múltiplas orgs) | Antes de escala |
| B.8 | Cache layer (Redis) | Antes de escala |
| B.9 | Filas (job queue para searches) | Antes de escala |
| B.10 | Sharding/banco separado | Antes de escala (>1000 orgs) |

---

## Ordem de implementação

```
Agora (Fase 0-4):    Baseline → Segurança → Multi-tenancy → Produção → Observabilidade
Próximo (Fase 5-8):  Controle → Beta → Onboarding → Suporte/Privacidade
Antes de pilotos:     Fases 0-4 + gates críticos da Fase 8
Depois (Fase 9):      Consolidação antes de abrir para mais pilotos
```

## Dependências externas

| Dependência | Para que | Status |
|------------|----------|--------|
| Supabase Cloud (prod) | Ambiente de produção | ✅ Configurado |
| Supabase Cloud (staging) | Ambiente de staging | ❓ Verificar |
| Google Places API | Buscas | ✅ Configurado |
| Sentry ou similar | Error tracking | ❌ Precisa criar conta |
| Stripe | Cobrança (futuro) | ❌ Não configurado |
| Provedor de e-mail | Transacionais | ❌ Não configurado |
| Linear ou similar | Gestão de feedback | ❌ Opcional |
