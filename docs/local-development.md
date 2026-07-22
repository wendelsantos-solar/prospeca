# Local Development

Monorepo (Bun Workspaces + Turborepo). Backend = Supabase (Postgres/PostGIS +
Auth + Edge Functions). No Redis/BullMQ (see `docs/adr/001-monorepo-architecture.md`).

## Prerequisites

- Bun ≥ 1.3
- Supabase CLI (for DB + Edge Functions locally): https://supabase.com/docs/guides/cli
- Docker (used by the Supabase CLI, or the fallback `infra/compose.yaml`)

## Install

```bash
bun install            # installs + links all workspaces
```

## Environment

Env files live at the **repo root** (`.env`, `.env.local`). `apps/web` reads
them via Vite `envDir`; edge functions read Supabase secrets. Copy the template:

```bash
cp .env.example .env.local
```

The app fails fast with a clear message when required config is missing
(`realConfigMissing()` in `apps/web/src/lib/env.ts`). Google keys are OPTIONAL —
leave them empty to run fully on OSM (Nominatim + Overpass + Leaflet tiles).

### Rodar sem Google (OSM-only)

Liga todos os subsistemas no OpenStreetMap — geocoding (Nominatim), descoberta
e detalhes de places (Overpass), tiles (Leaflet):

```bash
supabase secrets set USE_OSM_GEOCODER=true USE_OSM_PLACES=true USE_OSM_MAP_PROVIDER=true
```

No frontend (`.env.local`): `VITE_USE_OSM=true` e deixe `VITE_GOOGLE_MAPS_BROWSER_KEY=`
vazio. `GOOGLE_MAPS_SERVER_KEY` pode ficar ausente — `serverKey()` lança
`PROVIDER_UNAVAILABLE` se qualquer caminho Google for chamado por engano, então
uso acidental do Google falha alto em vez de silencioso.

## Run

```bash
bun run dev            # turbo: all apps (currently apps/web)
bun run dev:web        # web only (Vite, port 8080)
```

### Backend (Supabase)

```bash
supabase start                 # Postgres + Auth + Studio + Edge runtime
supabase db reset              # apply supabase/migrations (incl. additive Fase 5)
supabase functions serve       # run edge functions locally
```

Fallback DB-only (no full Supabase stack):

```bash
docker compose -f infra/compose.yaml up -d db
```

## Quality gates

```bash
bun run build          # turbo build (web) — MUST stay green
bun run lint           # eslint (pre-existing prettier errors — see below)
bun run typecheck      # tsc per package/app
bun run test           # bun test across packages (84 unit tests)
```

Package tests directly:

```bash
bun test packages/
```

## Enabling OSM providers (Strangler flags)

Default is Google. To switch a capability to OpenStreetMap, set the edge-function
secret and redeploy/serve:

```bash
supabase secrets set USE_OSM_GEOCODER=true    # Nominatim geocoding
supabase secrets set USE_OSM_PLACES=true      # Overpass business discovery
supabase secrets set OVERPASS_USER_AGENT="leads-platform/1.0 (you@example.com)"
```

The web map uses OSM/Leaflet tiles via `VITE_MAP_TILE_URL` + `VITE_MAP_ATTRIBUTION`.

## Known pre-existing issues (present before the monorepo refactor)

- `apps/web/src/components/app/SearchForm.tsx:157` — `setRadius` type error
  (`tsc` fails; Vite build unaffected).
- Several `prettier/prettier` lint errors in web files.
  These predate this work (documented in `docs/current-architecture.md`).
