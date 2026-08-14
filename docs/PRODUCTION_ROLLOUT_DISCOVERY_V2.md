# Production Rollout — Discovery Intelligence V2

> Roteiro completo para levar F1–F7 (fila, score V2, sinais/proveniência,
> território server-side, enriquecimento multi-fonte + CNPJ, NBA unificada +
> notificações, observabilidade) ao projeto Supabase de PRODUÇÃO.
>
> Estado atual do dev (referência): 65/65 migrations aplicadas, 11 functions
> deployadas com `--import-map`, smoke de pipeline e de UI validados.
> Este documento NÃO executa nada — é o passo a passo para execução.

## 1. Pré-requisitos do projeto de produção

### 1.1 Acesso

- Supabase CLI linkado ao projeto de produção:
  `supabase link --project-ref <PROD_REF>` (+ senha do banco para o push).
- Acesso ao dashboard do projeto para conferir secrets e logs.

### 1.2 Secrets das edge functions (dashboard → Settings → Edge Functions Secrets)

Obrigatórias para o fluxo V2 (nomes exatos lidos via `Deno.env.get`):

| Env var | Usada por | Obrigatória? |
|---|---|---|
| `SUPABASE_URL` | todas as functions + `_shared/dispatch.ts` (invoke entre functions) | **SIM** |
| `SUPABASE_ANON_KEY` | `_shared/auth.ts` (requireAuth monta o client do caller) | **SIM** |
| `SUPABASE_SERVICE_ROLE_KEY` | todas (adminClient + `isInternalCall`) | **SIM** |
| `GOOGLE_MAPS_SERVER_KEY` | `_shared/google.ts` (Places Text Search + Geocoding) | **SIM** — sem ela, busca falha (**BLOCKED_EXTERNAL_CONFIGURATION**) |
| `SEARCH_MAX_RESULTS` | `create-search` (cap de resultados; default 60) | Não (default 60) |
| `BUSINESS_REGISTRY_DISABLED` | `lookup-cnpj` (BrasilAPI; default ativa) | Não |
| `SENTRY_DSN` | `_shared/error-tracking.ts` | Não (fallback sem vendor) |
| `APP_ENV` / `APP_URL` | logs / links | Não (recomendado) |

Demais functions do projeto (billing/calendar/email) têm as próprias
(`STRIPE_*`, `GOOGLE_CALENDAR_*`, `RESEND_API_KEY`, `SMTP_FROM`, etc.) — não
fazem parte deste rollout, mas precisam estar setadas se já estavam em
produção.

### 1.3 Variáveis do app web (VITE_*)

| Env var | Obrigatória? |
|---|---|
| `VITE_SUPABASE_URL` | SIM |
| `VITE_SUPABASE_ANON_KEY` | SIM |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | SIM (mapa; restrita por domínio) |
| `VITE_DATA_MODE=real` | SIM |
| `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` | Não (defaults OSM) |

> Se `GOOGLE_MAPS_SERVER_KEY` (ou o faturamento do Google) não existir no
> projeto de produção: **BLOCKED_EXTERNAL_CONFIGURATION** — não prossiga com
> o smoke de busca; o restante (migrations + functions) pode ser aplicado
> mesmo assim (nada quebra sem busca).

## 2. Passo a passo

### 2.1 Baseline

```bash
supabase link --project-ref <PROD_REF>
supabase migration list   # deve mostrar as 65 locais; remote = baseline atual
```

### 2.2 Migrations

```bash
supabase db push
supabase migration list   # confirmar 65/65 (local == remote)
```

As migrations são **aditivas** (colunas novas, tabelas novas, RPCs, cron) —
nenhuma exige downgrade.

### 2.3 Deploy das functions

Todas com import map (obrigatório — importam `@leads/*`):

```bash
supabase functions deploy process-jobs          --import-map supabase/import_map.json
supabase functions deploy territory-analysis    --import-map supabase/import_map.json
supabase functions deploy score-company         --import-map supabase/import_map.json
supabase functions deploy execute-search        --import-map supabase/import_map.json
supabase functions deploy create-search         --import-map supabase/import_map.json
supabase functions deploy import-search-results --import-map supabase/import_map.json
supabase functions deploy enrich-discovery      --import-map supabase/import_map.json
supabase functions deploy lookup-cnpj           --import-map supabase/import_map.json
supabase functions deploy get-notifications     --import-map supabase/import_map.json
supabase functions deploy get-admin-jobs        --import-map supabase/import_map.json
supabase functions deploy get-search-status     --import-map supabase/import_map.json
```

- "No change found" = bundle já igual (bom).
- Se `error-tracking`/`dispatch`/`job-queue` mudarem, cada function que as
  importa já embute a nova versão no deploy.

### 2.4 Smoke de produção

1. 1 busca de 1 página (~US$0.03): "barbearia", raio 2000m, sem force
   refresh. Seguir `docs/UI_SMOKE_DISCOVERY_V2.md`.
2. Validação server-side (service role, SQL Editor ou API):
   - `searches.status = completed` (não `partial` — partial indicaria o
     antigo 42P10 ou outro erro de pós-processamento);
   - `jobs` todos `completed` (16 scoring + 1 territory no caso típico);
   - `search_results.score_breakdown->>'version' = 'v1.1.0'`;
   - `company_opportunity_scores.signals` não-nulo;
   - `company_sources` com `google_places/discovery`;
   - `territory_stats` com regiões (ou ausência honesta se amostra < 3);
   - `usage_events`: 1 × `place_search_request`.

## 3. Rollback / segurança

- **Migrations**: aditivas — não exigem downgrade; em último caso,
  `supabase db reset`/restore do backup (ver docs/BACKUP_AND_RECOVERY.md).
- **Functions**: reverter = redeployar o bundle anterior (git checkout do
  commit anterior + `functions deploy`). Sem estado local nas functions.
- **UI**: flag `v2ScoringInDiscovery` (default `true`) desliga o badge de
  confiança; `discoveryV2` desliga o card de inteligência; rollback total da
  ordem do mapa exige re-score v3.0.0 (decisão de produto, não emergência).
- **Cron sweeper**: desligável via SQL
  `select cron.unschedule('recover-stuck-jobs');` (jobs presos passam a
  esperar wake manual — sem perda de dados).

## 4. Pós-deploy

- Cron: `select cron.jobname, schedule from cron.job where jobname = 'recover-stuck-jobs';`
- Admin: painel → Processamento (métricas por tipo, dead-letter).
- Erros: `error-digest` (cron diário) + Sentry se `SENTRY_DSN` setado.
- Custo: `UsageCostCard` (mês) e `usage_events` por org; orçamento por org via
  `set_org_budget` (guarda-corpo já ativo no `create-search`/`execute-search`).

## 5. Riscos e gatilhos de pausa

| Gatilho | Ação |
|---|---|
| `searches.status = partial/failed` no smoke | PARAR — capturar `error_message` e logs da function; reportar antes de liberar busca real |
| Erro 42P10 reaparecendo (índice antigo em prod) | A migration `20260815000009` já troca para índice total — confirme que foi aplicada ANTES do deploy das functions novas |
| Custo acima do esperado (páginas > 1) | Conferir `provider_request_count`/`usage_events`; buscar causa antes de liberar usuários |
| Orçamento da org estourado | Comportamento esperado: busca responde `PLAN_LIMIT_REACHED` (402) — não é bug |
| BrasilAPI fora | Mensagem honesta no drawer; sem cascata — não é bug |

## 6. PR opcional

```bash
gh pr create --title "Discovery Intelligence V2 — F1-F7 (fila, score V2, território, CNPJ, NBA, observabilidade)" --body "Ver docs/DISCOVERY_INTELLIGENCE_V2_ARCHITECTURE.md e PRODUCTION_ROLLOUT_DISCOVERY_V2.md"
```

Decisão do usuário — não executar sem autorização.
