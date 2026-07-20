# Current Architecture — Audit (Fase 0)

> Snapshot at commit `9b0de63` (branch `main`). Read-only audit; no behavior changed.

## Stack real (auditada — não presumida)

| Camada | Tecnologia real | Evidência |
|---|---|---|
| Package manager | **Bun** (workspaces viáveis) | `bun.lock`, `bunfig.toml` |
| Frontend framework | **TanStack Start** (React 19 + Vite 8 + Nitro) | `package.json` deps `@tanstack/react-start`, `vite`, `nitro` |
| Roteamento | TanStack Router (file-based) | `src/routes/*` |
| Estado servidor | TanStack Query | `@tanstack/react-query` |
| Estado cliente | Zustand | `src/stores` |
| UI / Design system | Radix UI + Tailwind v4 + shadcn (`components.json`) | `@radix-ui/*`, `tailwindcss@4` |
| Mapa | **Leaflet + markercluster** (demo) **e Google Maps JS SDK** (real) | `leaflet`, `src/lib/map/GoogleMapProvider.ts`, `src/lib/map/types.ts` |
| Backend | **Supabase Edge Functions (Deno)** | `supabase/functions/*` |
| Banco | **PostgreSQL + PostGIS** (Supabase) | `supabase/migrations/*`, `geography(point,4326)`, `gist` index |
| Auth | **Supabase Auth** (JWT + RLS) | `_shared/auth.ts`, `migrations/*_rls.sql` |
| Validação | Zod | `zod` dep |
| Provider de dados | **Google Places API (New) + Google Geocoding** | `supabase/functions/_shared/google.ts` |

## O que roda no navegador
- Todas as rotas (`src/routes`): `login`, `cadastro`, `app.mapa`, `app.kanban`, `app.painel`, `app.historico`, `app.configuracoes`, etc.
- Repositórios que leem Postgres **direto** via `@supabase/supabase-js` sob RLS (`src/repositories/supabase.ts`).
- Mapa (Leaflet demo / Google real), filtros, listagens virtualizadas (`react-virtuoso`), Kanban (`@dnd-kit`), export.
- Feature flags e modo de dados via `src/lib/env.ts` (`VITE_DATA_MODE=real|demo`).

## O que roda no servidor (Supabase Edge Functions, Deno)
| Função | Papel | Long-running? |
|---|---|---|
| `create-search` | valida + persiste `searches` (status `queued`) + dispara worker | não (enfileira) |
| `execute-search` | **worker interno** (service-role): Google Text Search paginado, upsert `places`, link `search_results`, PostGIS, progresso, cancelamento | **sim** |
| `get-search-status` | polling de progresso | não |
| `cancel-search` | cancelamento | não |
| `import-search-results` | materializa `search_results` → `leads` | médio |
| `geocode-location` | geocode/reverse via Google | não |
| `create-export` | export | médio |
| `calculate-lead-score` | score | não |
| `refresh-place-details` | atualiza detalhes de place | não |
| `delete-account-data` | LGPD/GDPR delete | médio |
| `_shared/*` | `auth`, `http`, `google`, `normalize`, `score`, `geo`, `quota`, `idempotency` | — |

**Conclusão-chave:** o split API/worker **já existe** no idioma Supabase. `create-search` = API (enfileira), `execute-search` = worker (invocado com service-role). "Fila" = function-invokes-function; progresso = coluna `status` + polling.

## Tabelas existentes (migrations aditivas versionadas)
`organizations`, `organization_members`, `profiles`, `searches`, `places`, `search_results`, `leads`, `lead_notes`, `lead_activities`, `lead_stage_history`, `message_templates`, `audit_logs`, `usage_events`, `idempotency_keys`, `suppression_list`, `exports`, `geocode_cache`.
- PostGIS ativo; `searches.center` e `places.location` = `geography(point,4326)`; índice `gist`.
- RPCs: `search_leads_within_radius`, `leads_within_bounds`, `move_lead_stage`, `get_dashboard_overview`, `get_quota_status`.
- RLS por organização em todas as tabelas.

## Contratos que o frontend consome
- **Tabelas direto** (RLS) via `src/repositories/supabase.ts`.
- **Edge functions** via único ponto: `supabase.functions.invoke(name)` em `src/lib/supabase.ts`.
- Tipos em `src/types/index.ts`; `SearchInput` em `src/services/index.ts`.

## Dados mockados identificados
- `src/mocks/leads.ts` — `MOCK_LEADS`.
- `src/repositories/demo.ts` — repositórios demo.
- `src/services/index.ts` — `searchService.run` (haversine + filtro sobre MOCK_LEADS), `leadService`, `historyService`, `maybeFail` (erro simulado), `delay`.
- Selecionado por `VITE_DATA_MODE=demo`. **Modo real NÃO faz fallback silencioso para mock** (bom).

## Responsabilidades misturadas / riscos
1. **Frontend lê banco direto** (repositórios Supabase no browser) — a regra "web nunca chama banco" é parcialmente violada por design (RLS mitiga, mas acopla o front ao schema).
2. **Dependência dura de Google**: `execute-search`, `geocode-location`, `GoogleMapProvider` — não há adaptador OSM/Overpass. É o objetivo central da refatoração remover isso.
3. `src/lib/reverse-geocode.ts` + `GoogleMapProvider` acoplam o front ao Google (browser key).
4. Sem monorepo: lógica pura (score, normalize, geo, dedup) duplicada entre `src/lib/*` e `supabase/functions/_shared/*` (ex.: haversine em 2 lugares, score em 2 lugares).
5. Sem Redis/BullMQ — "fila" é invoke encadeado (aceitável no idioma Supabase; limite: timeout de edge function).

## Comandos disponíveis (auditados)
- Install: `bun install`
- Dev: `bun run dev` (vite dev)
- Build: `bun run build` (vite build)
- Lint: `bun run lint` (eslint)
- Format: `bun run format` (prettier)
- **Sem** script `typecheck` nem `test`. Typecheck manual: `bunx tsc --noEmit`.

## Baseline de validação (executado neste commit — estado PRÉEXISTENTE)
- `bun run lint` → **FALHA**: 7 erros (todos `prettier/prettier` de formatação) + 7 warnings `react-refresh`. Arquivos: `SearchForm.tsx`, `app.kanban.tsx`, `services/index.ts`, `message-template/constants.tsx`.
- `bunx tsc --noEmit` → **FALHA**: `src/components/app/SearchForm.tsx(157,23): TS2552: Cannot find name 'setRadius'`.
- `test` → inexistente.
- `build` → não executado no baseline (não bloquear auditoria); a validar após cada fase.

> **Estas falhas são PRÉEXISTENTES**, presentes no commit `9b0de63` antes de qualquer alteração da refatoração. Documentadas aqui para não serem atribuídas à migração.

## Variáveis de ambiente atuais (`.env.example`)
Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_DATA_MODE`.
Edge (secrets): `GOOGLE_MAPS_SERVER_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `APP_ENV`, `ENRICHMENT_PROVIDER`, `ENRICHMENT_API_KEY`.
