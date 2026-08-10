# Sentry Setup — Prospeca

**Status:** Código integrado. Aguardando DSN.

---

## O que já está implementado

- **Edge Functions:** `_shared/error-tracking.ts` — `captureError()` envia para Sentry quando `SENTRY_DSN` está configurado. Sem DSN, loga como JSON estruturado para o `error-digest` cron.
- **Frontend:** `lib/error-capture.ts` — `captureClientError()` persiste em `error_events` (sempre) e encaminha para Sentry quando `VITE_SENTRY_DSN` está configurado.
- **Fallback:** `error_events` table + `error-digest` cron (a cada 30min, e-mail agrupado se houver erro novo). Zero vendor dependency.

---

## Passos para ativar (ações do proprietário)

### 1. Criar projeto no Sentry

1. Acesse [sentry.io](https://sentry.io) e crie uma conta (ou use uma existente).
2. Crie um novo projeto: **Platform → Deno** para o backend, **Platform → JavaScript** para o frontend. Ou use um único projeto "JavaScript" para ambos.
3. Copie o DSN (Data Source Name). Formato: `https://<key>@<host>/<project_id>`.

### 2. Configurar variáveis de ambiente

```bash
# Edge Functions (via supabase secrets set)
supabase secrets set SENTRY_DSN="https://..."

# Frontend (via .env.local ou secrets do provedor de hospedagem)
VITE_SENTRY_DSN="https://..."
```

### 3. Configurar alertas no Sentry

No dashboard do Sentry:

1. **Alerts → Create Alert Rule**
2. Condição: `Number of errors > 5 in 5 minutes`
3. Ação: Notificar por e-mail / Slack

### 4. Verificar

1. Cause um erro controlado (ex: acesse uma rota inválida).
2. Verifique se aparece no dashboard do Sentry em < 1 minuto.
3. Verifique o `error-digest` — deve continuar funcionando como fallback.

---

## Variáveis

| Variável           | Onde configurar           | Obrigatória? | Descrição                                  |
| ------------------ | ------------------------- | ------------ | ------------------------------------------ |
| `SENTRY_DSN`       | `supabase secrets set`    | Não          | DSN do projeto Sentry para edge functions  |
| `VITE_SENTRY_DSN`  | `.env.local` / hospedagem | Não          | DSN do projeto Sentry para frontend        |
| `VITE_APP_VERSION` | `.env.local` / hospedagem | Não          | Release version para agrupamento no Sentry |

---

## Sem Sentry configurado

O sistema continua funcionando normalmente:

- Erros são persistidos em `error_events` (banco próprio).
- O `error-digest` cron envia e-mail agrupado a cada 30min (se `ADMIN_ALERT_EMAIL` estiver configurado).
- Logs estruturados em JSON para correlação por `requestId`.
