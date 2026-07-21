# Relatório de migração dos mocks — Radar Local

Atualizado em 2026-07-19.

## Fase 1 — Auditoria (concluída)

### Stack encontrada

- TanStack Start (React 19) + TanStack Router/Query, Tailwind 4, shadcn/ui,
  Zustand (5 stores com persistência em localStorage), Zod, RHF, Leaflet +
  markercluster, Recharts, bun.

### Mocks encontrados

| Item                                     | Local                   | Status                                      |
| ---------------------------------------- | ----------------------- | ------------------------------------------- |
| 50+ leads determinísticos                | `src/mocks/leads.ts`    | mantido p/ modo demo                        |
| Busca simulada (haversine + Math.random) | `src/services/index.ts` | substituível por `SupabaseSearchRepository` |
| Erros simulados (8%)                     | `src/services/index.ts` | apenas demo                                 |
| Progresso de busca com timer (7 passos)  | `SearchForm.tsx`        | pendente de troca por status real           |
| Histórico em localStorage                | stores Zustand          | rota real `/app/historico` criada           |
| Dashboard calculado no cliente           | `Dashboard.tsx`         | RPC `get_dashboard_overview` disponível     |
| Mapa Leaflet/OSM                         | `MapView.tsx`           | `GoogleMapProvider` criado; troca pendente  |

### Funcionalidades apenas visuais (antes desta fase)

- Autenticação inexistente; qualquer visitante acessava `/app`.
- Sem backend: nenhum dado persistia fora do localStorage.

## Fase 2 — Infraestrutura (concluída nesta entrega)

- 6 migrations (`supabase/migrations/`): 17 tabelas, PostGIS, RLS completa,
  5 RPCs, trigger de signup (perfil + organização + membership).
- 10 Edge Functions (`supabase/functions/`): create-search, execute-search,
  geocode-location, get-search-status, cancel-search, import-search-results,
  refresh-place-details, calculate-lead-score, create-export,
  delete-account-data. Shared: auth, quotas, rate limit, idempotência,
  cliente Google Places (FieldMask mínimo), normalização, score versionado.
- Autenticação: rotas `/login`, `/cadastro`, `/recuperar-senha`,
  `/redefinir-senha` + `AuthGate` protegendo `/app` em modo real.
- Feature flags e modo de dados: `VITE_DATA_MODE=real|demo`
  (`src/lib/env.ts`); modo real com config faltante ⇒ tela de erro de
  configuração (sem fallback silencioso); banner visível em modo demo.
- Repositories: contratos + `Supabase*` (reais) + `Demo*` (mocks explícitos).
- Diagnóstico: `/app/configuracoes` (status + teste de conexão/geocode).
- `MapProvider` + `GoogleMapProvider` (SDK lazy, clusters pendentes).
- `.env.example`, seed de dev, 8 documentos.

## Próximas fases

- **Fase 3 (CRM real)** — trocar stores Zustand de dados por TanStack Query +
  repositories nas telas (Kanban, lista, notas, atividades, detalhes).
- **Fase 4 (Busca real)** — ligar `SearchForm` ao `SupabaseSearchRepository`
  com polling de status real (remover timer simulado); tela de revisão de
  resultados antes da importação.
- **Fase 5 (Mapa real)** — substituir `MapView` Leaflet por `GoogleMapProvider`
  em modo real + marker clustering (`@googlemaps/markerclusterer`).
- **Fase 6 (Dashboard real)** — trocar cálculo client-side pela RPC.
- **Fase 7 (Enriquecimento)** — `NullEnrichmentProvider` +
  `WebsiteEnrichmentProvider` com proteção SSRF.
- **Fase 8 (Produção)** — testes automatizados, monitoramento, revisão final.

## O que ainda NÃO é real

- Telas continuam lendo dos stores Zustand/mocks até a Fase 3-6 (o modo demo
  permanece o modo funcional out-of-the-box; modo real exige config).
- Progresso de busca no `SearchForm` ainda é timer (backend real pronto,
  fiação pendente).
- Enriquecimento (e-mail/Instagram) — sem provedor; campos exibidos como
  indisponíveis quando ausentes.
- WhatsApp nunca é "verificado" — apenas `possible` para celulares válidos.
- Exportação XLSX — flag desligada; CSV real via `create-export`.
