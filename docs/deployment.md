# Deployment

Deployment model is unchanged by the monorepo refactor (see ADR-001): the web
app builds as a TanStack Start (Nitro) output; the backend is Supabase.

## Web (apps/web)

```bash
bun install
bun run build            # turbo -> apps/web build (Nitro output in apps/web/.output)
```

Deploy the Nitro output to the existing host. Build-time env (root `.env`):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_MODE=real`,
`VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION`. Google browser key optional.

## Database (Supabase)

Migrations are additive and versioned. Apply in order; never drop existing
tables/columns.

```bash
supabase db push          # apply supabase/migrations to the linked project
```

Fase 5 migration `20260720000001_lead_sources_enrichment.sql` is additive
(`create table if not exists`, `add column if not exists`) and safe to apply to
production. PostGIS is already enabled.

## Edge Functions

```bash
supabase functions deploy               # all functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... APP_URL=... APP_ENV=production
```

Provider selection (default = Google, no change on deploy):

```bash
# Opt in per capability, only after verifying with `supabase functions serve`:
supabase secrets set USE_OSM_GEOCODER=true
supabase secrets set USE_OSM_PLACES=true
supabase secrets set GEOCODER_USER_AGENT="leads-platform/1.0 (you@example.com)"
supabase secrets set OVERPASS_USER_AGENT="leads-platform/1.0 (you@example.com)"
```

The system runs with `GOOGLE_MAPS_SERVER_KEY` absent once OSM flags are on.

## Rollback

- Code: `git revert` or redeploy the previous build; `backup/pre-monorepo-lead-platform`
  branch points at the pre-refactor state.
- Providers: set the `USE_OSM_*` flags back to `false` (instant, no deploy needed
  if using `supabase secrets set`).
- DB: additive migrations require no rollback; new tables can be left in place.
