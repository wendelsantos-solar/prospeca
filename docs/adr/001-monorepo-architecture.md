# ADR 001 — Arquitetura de monorepo Supabase-native

- **Status:** Aceito
- **Data:** 2026-07-20
- **Decisores:** usuário (dono do produto) + arquitetura
- **Commit base:** `9b0de63` (branch `main`)

## Contexto

O brief pede transformar o projeto num monorepo com `apps/web`, `apps/api` (Fastify), `apps/worker` (BullMQ+Redis), Drizzle e providers OSM (Overpass/Nominatim) no lugar de Google Maps.

A auditoria (Fase 0) revelou a stack real:

- Frontend **TanStack Start** (React 19 + Vite + Nitro), package manager **Bun**.
- Backend **Supabase Edge Functions (Deno)** — já com split assíncrono (`create-search` enfileira, `execute-search` = worker), progresso por polling, quota, idempotência, cancelamento.
- **Postgres + PostGIS** (Supabase), 17 tabelas, RLS por organização, RPCs.
- Auth **Supabase**. Provider de dados **Google Places/Geocoding** (isolado em `_shared/google.ts`).

O próprio brief exige **não trocar tecnologia sem necessidade** e **preservar auth, banco e hospedagem**.

## Decisão

Adotar **monorepo Bun Workspaces + Turborepo**, mas **manter o backend em Supabase Edge Functions** em vez de introduzir Fastify + Redis + BullMQ.

- `apps/api`/`apps/worker` conceituais = edge functions existentes (`create-search` = API, `execute-search` = worker), não processos Node novos.
- "Fila" = cadeia de `functions.invoke` já existente + status em tabela (`searches.status`), não Redis/BullMQ.
- ORM: manter `@supabase/supabase-js` (sem Drizzle) — não há necessidade comprovada.
- O valor central do brief é entregue via **abstração de providers** (`PlacesProvider`, `GeocodingProvider`, `LeadEnricher`) + adaptadores **Overpass/Nominatim**, removendo a dependência dura de Google.

Confirmado pelo dono do produto em 2026-07-20 (opção "Manter Supabase").

## Alternativas consideradas

1. **Fastify + Redis + BullMQ (literal do brief).** Rejeitada: abandona Supabase Edge Functions/Auth/hosting, exige infra Redis nova + deploy novo, reimplementa auth — contradiz as regras de segurança do próprio brief; sem necessidade técnica comprovada.
2. **Híbrido (Supabase + worker Node/Redis só para jobs pesados).** Adiada: só se `execute-search`/enrich estourarem timeout de edge function. Reavaliar após medir.
3. **Supabase-native (escolhida).** Menor risco, zero migração de infra, entrega o desacoplamento de fornecedor.

## Consequências

**Positivas:** compatibilidade total, sem infra nova, providers plugáveis, packages puros testáveis, remoção da dependência de Google via config/flags, migrations aditivas.

**Negativas / limites:** jobs muito longos limitados pelo timeout de edge function (mitigável no futuro pela alternativa híbrida); compartilhar código entre Deno (edge) e Node/Vite (web) exige packages sem deps de runtime e import maps nas functions.

**Gatilho de reavaliação:** se a descoberta OSM/enriquecimento exceder o limite de execução das edge functions, promover `apps/worker` para processo Node + fila (Híbrido) sem tocar no frontend nem nos contratos.
