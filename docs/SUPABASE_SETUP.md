# Setup do Supabase — Rodar migrations e functions

Guia prático para aplicar **todo** o schema (migrations), publicar as Edge Functions
e configurar os secrets no projeto Supabase deste app.

- **Project ref:** `zxneketqrapvbxyqewar`
- **URL:** `https://zxneketqrapvbxyqewar.supabase.co`
- **CLI:** não instalada globalmente — usar via `npx supabase` (v2.109.x).

> ⚠️ `db push` e `functions deploy` **escrevem no banco de produção** e não são
> triviais de desfazer. Confirme que está no projeto certo antes de rodar.

---

## O que já existe no repositório

| Item | Local |
|---|---|
| Migrations (6) | `supabase/migrations/` — `000001_core` → `000006_rpcs` |
| Edge Functions (11) | `supabase/functions/` |
| Seed de dev | `supabase/seed/dev_seed.sql` |

Ordem das migrations (respeitar — há dependência entre elas):

1. `20260719000001_core.sql`
2. `20260719000002_search_places.sql`
3. `20260719000003_crm.sql`
4. `20260719000004_ops.sql`
5. `20260719000005_rls.sql`
6. `20260719000006_rpcs.sql`

---

## Caminho A — Supabase CLI (recomendado)

Os passos **2 e 3 são interativos** (abrem navegador / pedem senha).

### 1. Inicializar o CLI (cria `config.toml`, mantém migrations/functions)

```bash
npx supabase init
```

### 2. Login (abre o navegador para autorizar)

```bash
npx supabase login
```

### 3. Linkar ao projeto remoto

Pede a **Database password** — pega em
Dashboard → Settings → Database → *Database password*.

```bash
npx supabase link --project-ref zxneketqrapvbxyqewar
```

### 4. Aplicar TODAS as migrations no banco remoto

```bash
npx supabase db push
```

### 5. Publicar as Edge Functions

```bash
npx supabase functions deploy
```

Ou uma a uma:

```bash
npx supabase functions deploy create-search execute-search geocode-location \
  get-search-status cancel-search import-search-results \
  refresh-place-details calculate-lead-score create-export delete-account-data
```

### 6. Setar os secrets das Edge Functions

Apenas as chaves **sem** prefixo `VITE_` (server key do Google etc).
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` são injetadas
**automaticamente** pelo Supabase dentro das functions — não precisa setar.

```bash
npx supabase secrets set \
  GOOGLE_MAPS_SERVER_KEY=<server-key> \
  APP_URL=<url-do-app> \
  APP_ENV=production
```

### 7. Seed (opcional)

`supabase/seed/dev_seed.sql` é para ambiente **local** (roda em `supabase db reset`).
Para popular o remoto, cole o conteúdo no **SQL Editor** do dashboard e rode.

---

## Caminho B — Manual (sem CLI)

Dashboard → **SQL Editor** → cole cada arquivo de `supabase/migrations/*.sql`
na **ordem numérica** (000001 → 000006) e rode um por um. Depois crie as functions
manualmente pelo dashboard. Mais trabalhoso, mas dispensa senha/CLI.

---

## Verificação pós-migração

No **SQL Editor**:

```sql
-- Tabelas criadas
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- RPCs criadas (ex.: get_dashboard_overview)
select routine_name from information_schema.routines
where routine_schema = 'public' order by routine_name;

-- RLS habilitado nas tabelas
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';
```

Depois, no app com `VITE_DATA_MODE=real`, abra o **Painel** — se
`get_dashboard_overview` responder sem erro, o schema está no ar.

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `db push` falha em `000001_core` | Extensão faltando (ex.: PostGIS). Ative em Database → Extensions. |
| Telas do CRM dão erro de query | Migrations não aplicadas ou fora de ordem. |
| Functions retornam 401/500 | Secrets não setados (passo 6) ou função não deployada. |
| App abre na tela de "config error" | `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ausentes no `.env.local`. |
