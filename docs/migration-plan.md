# Migration Plan — Strangler incremental (Supabase-native)

> Regra-mestra: **incremental, aditivo, não-destrutivo**. Cada fase termina com `bun run build` verde e sem *novos* erros de lint/typecheck além dos pré-existentes (`setRadius`, prettier — ver `current-architecture.md`).

## Segurança (feito)
- [x] `git status`, branch `main`, HEAD `9b0de63` registrados.
- [x] Branch backup: `backup/pre-monorepo-lead-platform`.
- [x] Branch trabalho: `refactor/monorepo-lead-platform`.
- [x] Alterações não commitadas preservadas (carregadas para a branch nova).
- [x] Baseline: build OK; lint/typecheck com falhas **pré-existentes** documentadas.
- Proibido: `git reset --hard`, `git clean -fd`, `checkout -- .`, `restore .`.

## Fase 1 — Workspace (backbone)
- Root `package.json`: `workspaces: ["apps/*","packages/*"]`, scripts delegando ao turbo.
- `turbo.json` (build/lint/typecheck/dev pipelines).
- `tsconfig.base.json` com paths dos packages.
- **Verificação:** `bun install` resolve workspaces; build ainda verde (frontend continua em `./src` até a Fase 2).
- Commit: `chore(repo): create monorepo workspace structure`.

## Fase 2 — Mover frontend → apps/web
- `git mv` de `src/`, `public/`, `index.html`(se houver), `vite.config.ts`, `tsconfig.json`, `components.json`, `eslint.config.js`, `.prettier*` → `apps/web/`.
- Ajustar paths relativos, alias `@/*`, `router` plugin, Nitro output.
- `apps/web/package.json` com deps do frontend.
- **Verificação:** `bun run build` (web) verde; rotas carregam; nada de UI mudou.
- Commit: `refactor(web): move existing frontend into apps/web`.

## Fase 3 — packages/contracts + domain + geo
- `contracts`: `BusinessCandidate`, `GeocodingProvider`, `PlacesProvider`, `LeadEnricher`, DTOs de API (zod).
- `domain`: mover lógica pura duplicada (`normalize`, `score`, `dedup`, `cache-keys`, `phone`) — hoje espalhada em `src/lib/*` e `functions/_shared/*`.
- `geo`: `haversine`, `boundingBox`, `readPoint` (EWKB).
- **Testes unitários** (Fase 3): normalização nome/telefone, distância, bbox, dedup, score, cache keys.
- Commit: `feat(providers): add geocoding and places contracts` + `test(platform): domain unit coverage`.

## Fase 4 — Providers OSM
- `OverpassPlacesProvider` (`PlacesProvider`): query Overpass QL por bbox/raio+categoria → `BusinessCandidate[]`.
- `NominatimGeocodingProvider` (`GeocodingProvider`): `/search` + reverse.
- Guard SSRF (bloqueio de IPs privados/metadata), timeout, retry+backoff, cache (`geocode_cache` já existe), User-Agent obrigatório, concorrência limitada.
- Commit: `feat(providers): implement Overpass and Nominatim providers`.

## Fase 5 — Integrar OSM + flags + migrations
- `execute-search`/`geocode-location` selecionam provider por flag `USE_OSM_*` (default Google preservado até validação).
- Migrations **aditivas**: `lead_sources` (provider, external_id, source_url, raw_payload, collected_at), `lead_enrichments`, `lead_scores`. `lead_stage_history` já cobre status history.
- **Nunca** dropar tabela/coluna. Sem remoção imediata.
- Commit: `feat(providers): wire OSM discovery+geocode behind flags` + `feat(database): add lead_sources/enrichments`.

## Fase 6 — Mapa configurável + infra + docs
- Map provider Leaflet lê `MAP_TILE_URL`/`MAP_ATTRIBUTION` (sem URL hardcoded); atribuição obrigatória.
- `.env.example` atualizado; `docs/local-development.md`, `docs/deployment.md`; `infra/compose.yaml` (supabase local).
- Relatório final + validações reais.
- Commit: `feat(web): configurable map tiles` + `docs(platform): architecture and migration`.

## Estratégia Strangler / flags
- `USE_OSM_MAP_PROVIDER`, `USE_OSM_PLACES`, `USE_OSM_GEOCODER`, `USE_ASYNC_ENRICHMENT`.
- Google permanece funcional atrás de flag até OSM validado; depois vira opcional.
- Camada de compat: repositórios/`functions.invoke` inalterados para o front.

## Código legado a remover (após validação OSM)
- `functions/_shared/google.ts` (manter como adaptador opcional, não remover cedo).
- `src/lib/map/GoogleMapProvider.ts` (manter até `USE_OSM_MAP_PROVIDER` default).
- Duplicação de haversine/score/normalize (consolidar em `packages/domain`).

## Riscos
| Risco | Mitigação |
|---|---|
| Deno (edge) vs Node/Vite: compartilhar packages | `packages/domain|contracts|geo` sem deps runtime; import por caminho relativo/`deno.json` import map nas functions |
| Move do frontend quebrar Nitro/router | verificar build a cada passo; git mv preserva histórico |
| Overpass rate limit / instabilidade | cache + timeout + backoff + concorrência baixa + UA |
| SSRF em enrich/geocode | guard de IP privado/metadata obrigatório |
| Typecheck já quebrado (`setRadius`) | corrigir pontualmente OU documentar como pré-existente; não bloquear |
