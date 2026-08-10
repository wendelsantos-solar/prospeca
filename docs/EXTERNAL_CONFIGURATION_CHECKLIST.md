# External Configuration Checklist — Prospeca

**Data:** 2026-08-10
**Status:** Código integrado. Pendente de credenciais e configurações externas.

---

Este documento lista todas as configurações que dependem de serviços externos.
O código está pronto — você só precisa obter as credenciais e configurá-las.

---

## 1. Supabase (produção)

| Item                     | Dashboard                                                | Prioridade | Tempo estimado |
| ------------------------ | -------------------------------------------------------- | ---------- | -------------- |
| Criar projeto production | [supabase.com/dashboard](https://supabase.com/dashboard) | P0         | 10 min         |
| Aplicar migrations       | `supabase link --project-ref <ref> && supabase db push`  | P0         | 2 min          |
| Deploy edge functions    | `supabase functions deploy`                              | P0         | 5 min          |
| Configurar secrets       | `supabase secrets set ...`                               | P0         | 5 min          |

**Variáveis para `supabase secrets set`:**

```bash
SUPABASE_URL=<do dashboard>
SUPABASE_ANON_KEY=<do dashboard>
SUPABASE_SERVICE_ROLE_KEY=<do dashboard>
APP_URL=https://prospeca.com.br
APP_ENV=production
GOOGLE_MAPS_SERVER_KEY=<ver seção 3>
ANTHROPIC_API_KEY=<ver seção 7>
SEARCH_MAX_RESULTS=60
```

---

## 2. Stripe (billing)

| Item                  | Dashboard                                            | Prioridade | Tempo estimado |
| --------------------- | ---------------------------------------------------- | ---------- | -------------- |
| Criar conta Stripe    | [dashboard.stripe.com](https://dashboard.stripe.com) | P0         | 15 min         |
| Obter Secret Key      | Developers → API keys                                | P0         | 2 min          |
| Obter Publishable Key | Developers → API keys                                | P0         | 1 min          |
| Criar produtos/preços | Products → Add Product                               | P0         | 30 min         |
| Configurar webhook    | Developers → Webhooks                                | P0         | 10 min         |
| Obter Webhook Secret  | Developers → Webhooks → click on endpoint            | P0         | 1 min          |

**Produtos/preços a criar no Stripe:**

| Plano        | Preço mensal | Preço anual | Variável                                                     |
| ------------ | ------------ | ----------- | ------------------------------------------------------------ |
| Solo         | R$ 59,00     | R$ 590,00   | `STRIPE_PRICE_SOLO_MONTHLY` / `STRIPE_PRICE_SOLO_ANNUAL`     |
| Profissional | R$ 119,00    | R$ 1.190,00 | `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_ANNUAL`       |
| Agência      | R$ 299,00    | R$ 2.990,00 | `STRIPE_PRICE_AGENCY_MONTHLY` / `STRIPE_PRICE_AGENCY_ANNUAL` |

Após criar os preços, atualize a tabela `billing_plans` com os IDs:

```sql
UPDATE public.billing_plans
SET provider_monthly_price_id = '<stripe_price_id>',
    provider_annual_price_id = '<stripe_price_id>'
WHERE code = 'solo';
-- Repetir para 'professional' e 'agency'
```

**Webhook:** Cadastrar endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-billing/webhook` com eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**Variáveis:**

```bash
# Via supabase secrets set:
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (.env.local):
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 3. Google (Maps + Places)

| Item                       | Dashboard                                                    | Prioridade | Tempo estimado |
| -------------------------- | ------------------------------------------------------------ | ---------- | -------------- |
| Criar projeto GCP          | [console.cloud.google.com](https://console.cloud.google.com) | P0         | 10 min         |
| Habilitar Places API       | APIs & Services → Library                                    | P0         | 5 min          |
| Habilitar Geocoding API    | APIs & Services → Library                                    | P0         | 2 min          |
| Habilitar Maps JS API      | APIs & Services → Library                                    | P0         | 2 min          |
| Criar Server Key           | APIs & Services → Credentials                                | P0         | 5 min          |
| Criar Browser Key          | APIs & Services → Credentials                                | P0         | 5 min          |
| Restringir Browser Key     | Credentials → HTTP referrers                                 | P0         | 5 min          |
| Configurar billing account | Billing                                                      | P0         | 10 min         |

**Variáveis:**

```bash
# Edge functions:
GOOGLE_MAPS_SERVER_KEY=<server key>

# Frontend:
VITE_GOOGLE_MAPS_BROWSER_KEY=<browser key>
```

---

## 4. Google OAuth (login social)

| Item                    | Dashboard                                            | Prioridade | Tempo estimado |
| ----------------------- | ---------------------------------------------------- | ---------- | -------------- |
| Criar OAuth Client      | GCP → APIs & Services → Credentials                  | P1         | 10 min         |
| Configurar redirect URI | `https://<project-ref>.supabase.co/auth/v1/callback` | P1         | 2 min          |
| Obter Client ID         | Credentials → OAuth 2.0 Client IDs                   | P1         | 1 min          |
| Obter Client Secret     | Credentials → OAuth 2.0 Client IDs                   | P1         | 1 min          |

**Variáveis:**

```bash
# Frontend:
VITE_GOOGLE_CLIENT_ID=<client id>

# Configurar no Supabase Auth provider (dashboard):
# Authentication → Providers → Google → Enable
# Client ID: <client id>
# Client Secret: <client secret>
```

---

## 5. Google Calendar (integração)

| Item                    | Dashboard                                                                 | Prioridade | Tempo estimado |
| ----------------------- | ------------------------------------------------------------------------- | ---------- | -------------- |
| Criar OAuth Client      | GCP → APIs & Services → Credentials                                       | P2         | 10 min         |
| Habilitar Calendar API  | APIs & Services → Library                                                 | P2         | 2 min          |
| Configurar redirect URI | `https://<project-ref>.supabase.co/functions/v1/google-calendar/callback` | P2         | 2 min          |

**Variáveis:**

```bash
GOOGLE_CALENDAR_CLIENT_ID=<client id>
GOOGLE_CALENDAR_CLIENT_SECRET=<client secret>
GOOGLE_CALENDAR_REDIRECT_URI=<redirect uri>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<random 32 bytes base64>
```

---

## 6. Sentry (error tracking)

| Item               | Dashboard                      | Prioridade | Tempo estimado |
| ------------------ | ------------------------------ | ---------- | -------------- |
| Criar conta Sentry | [sentry.io](https://sentry.io) | P0         | 10 min         |
| Criar projeto      | Projects → Create Project      | P0         | 5 min          |
| Obter DSN          | Settings → Client Keys (DSN)   | P0         | 1 min          |

**Variáveis:**

```bash
# Edge functions:
SENTRY_DSN=https://<key>@<host>/<project>

# Frontend:
VITE_SENTRY_DSN=https://<key>@<host>/<project>
```

---

## 7. Anthropic (AI messages)

| Item                  | Dashboard                                              | Prioridade | Tempo estimado |
| --------------------- | ------------------------------------------------------ | ---------- | -------------- |
| Criar conta Anthropic | [console.anthropic.com](https://console.anthropic.com) | P2         | 10 min         |
| Obter API Key         | API Keys                                               | P2         | 2 min          |

**Variáveis:**

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 8. E-mail (Resend)

| Item               | Dashboard                        | Prioridade | Tempo estimado |
| ------------------ | -------------------------------- | ---------- | -------------- |
| Criar conta Resend | [resend.com](https://resend.com) | P1         | 10 min         |
| Verificar domínio  | Domains → Add Domain             | P1         | 15 min         |
| Obter API Key      | API Keys                         | P1         | 2 min          |

**Variáveis:**

```bash
RESEND_API_KEY=re_...
SMTP_FROM="Prospeca <suporte@prospeca.com.br>"
ADMIN_ALERT_EMAIL=admin@prospeca.com.br
SALES_NOTIFY_EMAIL=vendas@prospeca.com.br
```

---

## 9. Domínio e DNS

| Item                      | Onde configurar                    | Prioridade | Tempo estimado |
| ------------------------- | ---------------------------------- | ---------- | -------------- |
| Registrar domínio         | Registro.br / GoDaddy / Cloudflare | P0         | 15 min         |
| Configurar DNS            | Provedor DNS                       | P0         | 15 min         |
| Configurar CDN (opcional) | Cloudflare                         | P2         | 30 min         |

---

## 10. Monitoramento externo

| Item                               | Dashboard                                                                | Prioridade | Tempo estimado |
| ---------------------------------- | ------------------------------------------------------------------------ | ---------- | -------------- |
| Criar conta UptimeRobot            | [uptimerobot.com](https://uptimerobot.com)                               | P1         | 5 min          |
| Criar monitor HTTP                 | Add New Monitor → HTTP(s)                                                | P1         | 2 min          |
| Apontar para `/health-check/ready` | URL: `https://<project-ref>.supabase.co/functions/v1/health-check/ready` | P1         | 1 min          |

---

## Como validar cada configuração

1. **Supabase:** `supabase functions deploy` + acessar `/app` em modo real
2. **Stripe:** Criar checkout de teste com `planCode: "solo"`, verificar redirect
3. **Google Maps:** Executar uma busca real em `/app/mapa`
4. **Google OAuth:** Clicar "Cadastrar com Google"
5. **Sentry:** Causar erro controlado, verificar dashboard em <1min
6. **E-mail:** Enviar feedback via formulário, verificar recebimento
7. **Uptime:** Aguardar primeiro check (~5min)
