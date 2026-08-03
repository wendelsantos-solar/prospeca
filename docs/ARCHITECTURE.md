# Arquitetura — Prospeca

## Visão geral

```text
Frontend (React 19 + TanStack Start/Router/Query, Tailwind, shadcn/ui)
    |
    | HTTPS autenticado (JWT Supabase)
    v
Supabase Edge Functions (Deno)
    |  validação (Zod), autorização, quotas, rate limit, idempotência, cache
    v
Integrações externas
    ├── Google Places API (New)  — Text Search / Nearby / Details
    └── Google Geocoding API

Supabase PostgreSQL + PostGIS
    ├── organizations / organization_members / profiles
    ├── searches / places / search_results
    ├── leads / lead_notes / lead_activities / lead_stage_history
    ├── message_templates / suppression_list
    └── audit_logs / usage_events / idempotency_keys / exports / geocode_cache
```

Regra central: **o navegador nunca chama uma API externa com segredo privado**.
`GOOGLE_MAPS_SERVER_KEY` vive apenas nas Edge Functions. O navegador usa
somente `VITE_GOOGLE_MAPS_BROWSER_KEY` (restrita por domínio, apenas Maps JS API).

## Camadas do frontend

- `src/lib/env.ts` — modo de dados (`real`/`demo`), feature flags centralizadas.
- `src/lib/supabase.ts` — cliente browser (anon key, RLS) + invocação de Edge Functions.
- `src/repositories/` — contratos (`LeadRepository`, `SearchRepository`,
  `DashboardRepository`) com implementações `Supabase*` (reais) e `Demo*`
  (mocks, apenas `VITE_DATA_MODE=demo`). Sem fallback silencioso: modo real com
  config incompleta lança erro e exibe tela de configuração.
- `src/lib/map/` — abstração `MapProvider` com `GoogleMapProvider`.
  Leaflet permanece apenas para o modo demo (dados fictícios); resultados do
  Google Places nunca são renderizados sobre OpenStreetMap.
- `src/lib/queryKeys.ts` — chaves TanStack Query consistentes.

## Fluxo de busca real

1. Frontend valida via Zod e chama `create-search` (com idempotency key).
2. `create-search`: autentica, verifica quota/rate limit, geocodifica com cache,
   grava `searches` com status `queued`, dispara `execute-search` (assíncrono).
3. `execute-search` (service role): Text Search paginado (FieldMask mínimo,
   máx. 3 páginas), upsert em `places`, associação em `search_results`,
   validação de distância, progresso real gravado no banco.
4. Frontend acompanha por polling em `get-search-status` (ou Realtime).
5. Usuário revisa resultados e chama `import-search-results` (dedupe:
   place_id → telefone E.164 → domínio). Falha parcial ⇒ status `partial`.

## Multi-tenant

Toda entidade comercial tem `organization_id`. RLS em todas as tabelas com a
função `is_organization_member()` (SECURITY DEFINER). Signup cria
perfil + organização pessoal + membership `owner` via trigger.
