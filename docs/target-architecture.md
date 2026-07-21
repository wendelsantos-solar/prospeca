# Target Architecture — Monorepo Supabase-native

> Decisão: **manter Supabase** (Edge Functions + Postgres/PostGIS + Auth). Ver `adr/001-monorepo-architecture.md`.
> A árvore genérica do brief (Fastify/BullMQ/Redis/Drizzle) foi **adaptada ao projeto real** conforme a regra "não trocar tecnologia sem necessidade" e "preservar auth/DB/hosting".

## Princípio

O objetivo real do brief — **desacoplar o sistema de fornecedores (Google), separar responsabilidades e permitir múltiplas fontes de dados** — é atingido com abstrações de provider e um monorepo de packages, **sem** reescrever o backend serverless.

## Árvore alvo (adaptada)

```text
/
├── apps/
│   ├── web/                 # frontend TanStack Start (movido de ./src)
│   └── functions/           # Supabase Edge Functions (movido de ./supabase/functions)
│                            #   create-search = API (enfileira)
│                            #   execute-search = worker (descoberta/enrich)
├── packages/
│   ├── contracts/           # tipos + zod compartilhados FE↔edge (BusinessCandidate,
│   │                        #   GeocodingProvider, PlacesProvider, LeadEnricher, DTOs de API)
│   ├── domain/              # regras PURAS: normalize, score, dedup, geo, cache-keys
│   │                        #   (sem React, sem Supabase, sem fetch)
│   ├── providers/           # adaptadores: OverpassPlaces, NominatimGeocoding,
│   │                        #   GooglePlaces (legado), guard SSRF, cache
│   ├── geo/                 # haversine, bounding box, EWKB decode (readPoint)
│   ├── config/              # validação de env no startup
│   └── logger/              # log estruturado (sem segredos)
├── supabase/
│   ├── migrations/          # aditivas, versionadas
│   └── config.toml
├── infra/
│   └── compose.yaml         # supabase local (db+studio) para dev
├── docs/
├── package.json             # Bun workspaces
├── turbo.json               # orquestração de tasks
└── tsconfig.base.json
```

> **Sem pacotes vazios.** `queue`, `ui`, `testing` só nascem quando houver 2+ consumidores reais. `apps/worker` não é criado como processo Node separado — o worker é a edge function `execute-search`.

## Responsabilidades

| Unidade                         | Responsabilidade                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                      | UI, mapa (Leaflet), listagens, filtros, Kanban, progresso. **Só fala com API/tabelas via repositórios e `functions.invoke`.** |
| `apps/functions/create-search`  | validação, auth, quota, enfileira busca (status `queued`), retorna `searchId`+status. Não espera terminar.                    |
| `apps/functions/execute-search` | **worker**: geocode → discover (provider) → normalize → dedup → persist → progresso. Service-role.                            |
| `apps/functions/*enrich*`       | enriquecimento assíncrono, separado da descoberta.                                                                            |
| `packages/contracts`            | fronteira de tipos entre camadas; provider interfaces.                                                                        |
| `packages/domain`               | regras de negócio testáveis e puras.                                                                                          |
| `packages/providers`            | isola Overpass/Nominatim/Google atrás de contratos.                                                                           |

## Regras de dependência (aplicadas)

```text
apps/web        → contracts, (ui)
apps/functions  → contracts, domain, providers, geo, config, logger
packages/domain → (nada externo: sem React/Supabase/fetch/ORM)
packages/providers → contracts, geo, domain, config, logger
```

`domain` nunca importa Supabase, React, fetch ou provider externo. Infra implementa contratos definidos por dentro.

## Fluxo de busca (alvo)

```text
web POST create-search
  → create-search: valida + persiste searches(queued) + invoke execute-search
    → execute-search (worker):
        geocode.location   (GeocodingProvider: Nominatim | Google)
        discover.businesses(PlacesProvider: Overpass | Google)  → BusinessCandidate[]
        normalize.results  (domain)
        deduplicate.leads  (domain: nome+fone+domínio+geo)
        persist.leads      (+ lead_sources: provider, source_url, collected_at)
        update progress     (searches.status: searching→importing→completed/partial)
  → web get-search-status (polling) → mapa/lista
```

## Fluxo de enriquecimento (alvo)

```text
web POST enrich (lead/batch)
  → função assíncrona: LeadEnricher.enrich()
      cada campo → { value, confidence, sourceUrl, collectedAt, provider, verification }
      não encontrado → estado explícito "not_found" (nunca inventar)
  → persiste lead_enrichments; web consulta progresso
```

## Sem Google obrigatório

- Mapa: `MAP_TILE_URL`/`MAP_ATTRIBUTION` + Leaflet (já presente). `USE_OSM_MAP_PROVIDER`.
- Geocode: `NominatimGeocodingProvider` (`GEOCODER_BASE_URL`) atrás de `GeocodingProvider`.
- Descoberta: `OverpassPlacesProvider` (`OVERPASS_BASE_URL`) atrás de `PlacesProvider`.
- Google permanece como adaptador opcional (`GOOGLE_MAPS_SERVER_KEY` opcional), selecionado por flag.
- Sistema funciona com `GOOGLE_MAPS_API_KEY`/`GOOGLE_PLACES_API_KEY` **ausentes**.
