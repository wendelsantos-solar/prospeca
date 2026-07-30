# Observability — Radar Local

**Data:** 2026-07-30
**Status:** Fundação implementada, melhorias pendentes

---

## Pilares

### 1. Logs estruturados

**Implementado:** ✅ `logEvent()` nas edge functions (JSON)

```typescript
// supabase/functions/_shared/http.ts
export function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields));
}
```

**Contexto padrão de log:**

```json
{
  "timestamp": "2026-07-30T12:00:00.000Z",
  "level": "info",
  "environment": "production",
  "service": "create-search",
  "requestId": "uuid",
  "userId": "uuid (safe)",
  "organizationId": "uuid",
  "operation": "search_created",
  "duration": 1234,
  "status": "ok"
}
```

**O que NÃO logar:** senhas, tokens, chaves de API, conteúdo sensível completo,
dados pessoais sem necessidade.

### 2. Request ID

**Implementado:** ✅ `newRequestId()` nas edge functions

Cada resposta de erro inclui `requestId` para correlação.
Frontend pode capturar e exibir ao usuário ("Erro ref: abc123").

### 3. Error Tracking

**Implementado:** ❌ Pendente

**Recomendação:** Sentry (suporta Deno/Edge Functions e React)

Ações:
- [ ] Criar conta Sentry
- [ ] Adicionar `SENTRY_DSN` como secret
- [ ] Integrar nas edge functions (`_shared/http.ts`)
- [ ] Integrar no frontend (error boundary)
- [ ] Configurar sourcemaps no build
- [ ] Configurar alertas (erros 5xx, quota exceeded)

### 4. Health Checks

**Implementado:** ✅ `/health-check` e `/health-check/ready`

- `GET /health-check` → 200 (processo vivo)
- `GET /health-check/ready` → 200/503 (banco + dependências)

### 5. Métricas

**Implementado:** ⚠️ Parcial

- Admin panel: visão de consumo, cache, organizações, saúde operacional
- Pendente: métricas de negócio (ativação, engajamento, conversão)
- Pendente: dashboards de produto para o beta

### 6. Alertas

**Implementado:** ❌ Pendente

Alertas necessários:
- [ ] Erro 5xx em edge function (threshold: > 5 em 5 min)
- [ ] Quota do Google Places excedida
- [ ] Budget de organização estourado
- [ ] Busca presa há > 15 min
- [ ] Falha de backup
- [ ] Certificado SSL próximo de expirar
- [ ] Piloto inativo há 7 dias (para acompanhamento humano)

### 7. Audit Logs

**Implementado:** ✅ `audit_logs` table + `writeAudit()` helper

Ações registradas: criar/atualizar organização, membership changes, convites,
buscas, exports, feedback.

**Pendente:** Estender para mais ações (login, role changes, plan changes,
budget changes, pilot status changes).

### 8. Tracing

**Implementado:** ❌ Não implementado

Não necessário para beta com 5-10 pilotos. Considerar quando houver 50+
organizações ou latência acima de 2s no p95.

---

## Dashboard de operação (para o time)

O que monitorar durante o beta:

| Métrica | Fonte | Frequência |
|---------|-------|-----------|
| Erros por edge function | Sentry / logs | Tempo real |
| Latência p95 das edge functions | Supabase logs | Diário |
| Custo Google estimado (dia) | Admin panel | Diário |
| Buscas completadas vs. falhas | Admin panel | Diário |
| Organizações ativas (7d) | Query manual | Semanal |
| Pilotos ativos | Admin panel | Semanal |
| Feedback reports abertos | Tabela feedback | Semanal |

---

## Runbook de incidentes

Ver `INCIDENT_RESPONSE.md`.

---

## Próximos passos

1. Integrar Sentry (antes do primeiro piloto)
2. Configurar alertas de erro crítico
3. Adicionar dashboard de métricas de produto ao admin
4. Estender audit logs para mais ações
5. Configurar monitoramento de uptime (ex: Upptime, Better Uptime)
