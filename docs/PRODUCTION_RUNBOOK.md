# Production Runbook — Radar Local

**Data:** 2026-07-30
**Versão:** 1.0

---

## Acesso

### Supabase Dashboard

- URL: https://supabase.com/dashboard
- Projeto produção: (preencher)
- Projeto staging: (preencher)

### Deploy

- Frontend: (plataforma de hosting a definir)
- Edge Functions: `supabase functions deploy`

---

## Procedimentos comuns

### Deploy de migration

```bash
# 1. Testar em staging
supabase db push --linked --password

# 2. Verificar health
curl https://staging.xxx.supabase.co/functions/v1/health-check/ready

# 3. Deploy em produção
supabase db push --linked --password

# 4. Verificar health
curl https://xxx.supabase.co/functions/v1/health-check/ready
```

### Deploy de edge function

```bash
# Deploy de uma função específica
supabase functions deploy create-search

# Deploy de todas as funções
supabase functions deploy

# Verificar
curl https://xxx.supabase.co/functions/v1/health-check
```

### Rollback de migration

```bash
# 1. Criar migration de reversão
# 2. Aplicar como qualquer migration
# 3. NUNCA usar supabase db reset em produção
```

### Criar acesso piloto (admin)

Via Supabase SQL Editor ou edge function:

```sql
-- Criar organização piloto
INSERT INTO public.organizations (name, owner_user_id, plan, pilot_status, pilot_ends_at)
VALUES ('Nome do Piloto', 'user-uuid', 'pilot', 'invited', now() + interval '30 days');

-- Ou atualizar organização existente
UPDATE public.organizations
SET plan = 'pilot',
    pilot_status = 'invited',
    pilot_ends_at = now() + interval '30 days'
WHERE id = 'org-uuid';

-- Atualizar subscription
UPDATE public.subscriptions
SET plan_id = (SELECT id FROM public.billing_plans WHERE code = 'pilot'),
    status = 'trialing'
WHERE organization_id = 'org-uuid';
```

### Verificar saúde do sistema

```bash
# Health check
curl https://xxx.supabase.co/functions/v1/health-check
curl https://xxx.supabase.co/functions/v1/health-check/ready
```

### Verificar consumo

Acessar `/app/admin` (requer platform_admin) ou usar SQL:

```sql
-- Custo Google do mês atual
SELECT organization_id, SUM(estimated_cost) as cost
FROM public.usage_events
WHERE created_at >= date_trunc('month', now())
  AND estimated_cost IS NOT NULL
GROUP BY organization_id
ORDER BY cost DESC;
```

---

## Monitoramento diário (durante beta)

- [ ] Verificar admin panel: buscas stuck, falhas, budget
- [ ] Verificar feedback reports abertos
- [ ] Verificar erros no Sentry/logs
- [ ] Verificar custo Google (não passou do orçamento?)
- [ ] Responder dúvidas de pilotos em até 24h

## Monitoramento semanal

- [ ] Verificar pilotos ativos (últimos 7 dias)
- [ ] Verificar onboardings concluídos
- [ ] Coletar feedback qualitativo (check-in com pilotos)
- [ ] Atualizar métricas do programa piloto

---

## Comandos úteis

```bash
# Typecheck
bun run typecheck

# Lint
bun run lint

# Test
bun run test

# Build
bun run build

# Dev
bun run dev

# Formatar
bun run format
```
