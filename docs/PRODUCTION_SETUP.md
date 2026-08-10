# Production Setup Guide — Prospeca

**Data:** 2026-08-10
**Branch:** `feat/production-readiness-implementation`

---

Este guia cobre todos os passos para configurar o Prospeca em produção.
Cada passo possui uma checklist para você marcar conforme for concluindo.

---

## Pré-requisitos

- [ ] Conta Supabase (Pro ou Team — necessário para PITR/backups)
- [ ] Conta Stripe (para billing)
- [ ] Conta Google Cloud Platform (para Places API, Maps, OAuth)
- [ ] Conta Sentry (para error tracking)
- [ ] Conta Resend (para e-mails transacionais)
- [ ] Domínio registrado (`prospeca.com.br` ou similar)
- [ ] Bun 1.3+ instalado localmente
- [ ] Supabase CLI instalado (`brew install supabase/tap/supabase` ou similar)

---

## 1. Supabase — Provisionamento

### 1.1 Criar projeto de produção

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. New project → nome: `prospeca-prod` → região: `sa-east-1 (São Paulo)`
3. Plano: **Pro** (mínimo — PITR requer Pro+)
4. Aguardar provisionamento (~2min)

### 1.2 Criar projeto de staging

1. Mesmo processo → nome: `prospeca-staging`
2. Plano: **Free** (suficiente para staging)
3. Nunca use dados reais de usuário em staging

### 1.3 Configurar CLI local

```bash
# Link ao projeto de produção
supabase link --project-ref <production-ref>
# Aplicar migrations
supabase db push

# Para staging, use um .env.staging separado ou link manual
```

### 1.4 Configurar secrets

```bash
supabase secrets set \
  SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon-key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  APP_URL="https://prospeca.com.br" \
  APP_ENV="production" \
  GOOGLE_MAPS_SERVER_KEY="<server-key>" \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  RESEND_API_KEY="re_..." \
  SMTP_FROM="Prospeca <suporte@prospeca.com.br>" \
  ADMIN_ALERT_EMAIL="admin@prospeca.com.br" \
  SALES_NOTIFY_EMAIL="vendas@prospeca.com.br" \
  SENTRY_DSN="https://..." \
  SEARCH_MAX_RESULTS="60"
```

### 1.5 Deploy edge functions

```bash
supabase functions deploy
```

### 1.6 Verificar

```bash
curl https://<project-ref>.supabase.co/functions/v1/health-check/ready
# Deve retornar {"status":"ok"}
```

---

## 2. Banco de dados

### 2.1 Verificar migrations

```bash
supabase migration list --linked
# Todas as migrations devem estar como "applied"
```

### 2.2 Configurar backup (PITR)

1. Supabase Dashboard → Database → Backups
2. Verificar que PITR está habilitado (plano Pro+)
3. Anotar RPO (Point-in-time) máximo

### 2.3 Testar restore (trimestral)

Ver `docs/BACKUP_AND_RECOVERY.md` para o procedimento.

---

## 3. Stripe — Billing

### 3.1 Criar produtos e preços

1. [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
2. Criar produtos:

| Nome         | Preço mensal | Preço anual |
| ------------ | ------------ | ----------- |
| Solo         | R$ 59,00     | R$ 590,00   |
| Profissional | R$ 119,00    | R$ 1.190,00 |
| Agência      | R$ 299,00    | R$ 2.990,00 |

3. Anotar os `price_...` IDs de cada um

### 3.2 Atualizar billing_plans

```sql
UPDATE public.billing_plans
SET provider_monthly_price_id = '<price_id>',
    provider_annual_price_id = '<price_id>'
WHERE code = 'solo';

-- Repetir para 'professional' e 'agency'
```

### 3.3 Configurar webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-billing/webhook`
3. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Anotar `whsec_...` signing secret

### 3.4 Configurar secrets Stripe

```bash
supabase secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## 4. Google Cloud — APIs

### 4.1 Places & Geocoding API

1. [console.cloud.google.com](https://console.cloud.google.com)
2. Criar projeto ou usar existente
3. Habilitar: Places API (New), Geocoding API
4. Criar API Key (server) → restringir por IP (edge function IPs)
5. Habilitar billing na conta GCP

### 4.2 Maps JavaScript API (browser)

1. Habilitar Maps JavaScript API
2. Criar API Key (browser) → restringir por HTTP referrer (`*.prospeca.com.br`)
3. Esta key vai no frontend (VITE_GOOGLE_MAPS_BROWSER_KEY)

### 4.3 Google OAuth (login social)

1. APIs & Services → Credentials → Create OAuth Client ID
2. Application type: Web application
3. Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Anotar Client ID e Client Secret

---

## 5. Frontend — Deploy

### 5.1 Configurar variáveis de ambiente

```bash
# .env.production (ou secrets do provedor de hospedagem)
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GOOGLE_MAPS_BROWSER_KEY=<browser-key>
VITE_GOOGLE_CLIENT_ID=<oauth-client-id>
VITE_DATA_MODE=real
VITE_APP_VERSION=<git-sha>
VITE_SENTRY_DSN=https://<sentry-dsn>
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 5.2 Build e deploy

```bash
bun install --frozen-lockfile
bun run build
# Deploy do diretório apps/web/.output para o provedor de hospedagem
```

### 5.3 Smoke test

```bash
# Verificar página inicial
curl -I https://prospeca.com.br
# Verificar rota do app
curl -I https://prospeca.com.br/app
# Verificar API
curl https://<project-ref>.supabase.co/functions/v1/health-check/ready
```

---

## 6. Domínio e DNS

### 6.1 Configurar DNS

| Tipo  | Nome | Valor                                         |
| ----- | ---- | --------------------------------------------- |
| A     | @    | IP do provedor de hospedagem                  |
| CNAME | www  | @ (ou IP do provedor)                         |
| CNAME | api  | `<project-ref>.supabase.co` (se quiser proxy) |

### 6.2 SSL

- Supabase já provê SSL para as edge functions.
- O provedor de hospedagem deve prover SSL para o frontend (Let's Encrypt ou similar).

---

## 7. Monitoramento

### 7.1 Uptime Robot

1. Criar monitor HTTP para `https://<project-ref>.supabase.co/functions/v1/health-check/ready`
2. Intervalo: 5 minutos
3. Alertas: e-mail + Slack (se configurado)

### 7.2 Sentry

1. Verificar que erros aparecem no dashboard
2. Configurar alertas: >5 erros em 5min → e-mail/Slack

### 7.3 Supabase Dashboard

- Logs: Database → Logs / Edge Functions → Logs
- Métricas: Reports → Database / API

---

## 8. Checklist de verificação final

- [ ] Login funciona
- [ ] Cadastro funciona (com confirmação de e-mail)
- [ ] Google OAuth funciona
- [ ] Busca real funciona (Google Places)
- [ ] Stripe checkout funciona (teste com cartão `4242 4242 4242 4242`)
- [ ] Webhook Stripe processado corretamente
- [ ] E-mails transacionais enviados
- [ ] Sentry recebendo erros
- [ ] Uptime Robot ativo
- [ ] Backups configurados e verificados
- [ ] Staging funcional e isolado
- [ ] Termos de Uso e Privacidade acessíveis
- [ ] LGPD: exclusão de conta funcional
- [ ] Rate limiting ativo
