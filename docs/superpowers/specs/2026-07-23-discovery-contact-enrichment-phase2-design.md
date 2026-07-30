# Discovery Contact Enrichment (Phase 2) — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)
**Parent goal:** Improve lead data quality. Phase 1 (score recalibration) is done.

## Problem & Scope

Phase 1 already fixed temperature discrimination. Phase 2's value is **contact
data for outreach**, NOT temperature: scrape each discovered business's own
website (SSRF-guarded, the `enrichFromWebsite` helper already exists) to fill
**email / instagram / whatsapp** at discovery time, before the business enters
the funnel. Score impact is at most +15 (email 10 + instagram 5; whatsapp is
already "possible" from a mobile phone) and only for **with-site** businesses.
No-site businesses (the hot targets) can't be scraped — that's Phase 3, out of
scope here.

## Decisions

| Question | Decision |
|---|---|
| Enrichment storage | New columns on `places` (business-level, reused across searches) |
| Which results | Top **25** by score that have a website and aren't already enriched |
| Execution | Async, server-side inside a new `enrich-discovery` edge function; concurrency 5, 4 s per-site timeout |
| Trigger | The **client** fires `enrich-discovery({searchId})` fire-and-forget after a search completes (matches existing client-orchestrated flow; `execute-search` does not invoke other functions today) |
| On-open | Opening Detalhes for a with-site, not-yet-enriched business calls `enrich-discovery({searchId, placeId})` (lazy, single) and awaits |
| UI refresh | `useDiscoveryResults` polls (short `refetchInterval`) for ~30 s after a search completes; on-open awaits then refetches |
| Cache | Skip places with a recent `enriched_at` (reused on re-search) |
| No-site businesses | Not enriched (Phase 3) |

## Data Model

Add to `public.places` (new migration):

```sql
alter table public.places
  add column if not exists email text,
  add column if not exists instagram text,
  add column if not exists whatsapp text,
  add column if not exists whatsapp_status text not null default 'unknown'
    check (whatsapp_status in ('unknown','possible','verified','invalid')),
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_status text; -- 'ok' | 'not_found' | 'blocked' | null
```

Enrichment is a property of the business (place), shared across searches. A
re-search that hits the same place reuses its enrichment.

## Scoring input change (both mirrors)

`scoreInputFromPlace` currently hardcodes `hasEmail: false`, `hasInstagram:
false`. Make it read from the place, so the SAME function scores correctly both
at search time (place unenriched → false) and at re-score time (place enriched):

- `packages/domain/src/score-input.ts` — extend `PlaceLike` with `email?`,
  `instagram?`, `whatsapp?` and set:
  - `hasEmail: place.email != null && place.email !== ""`
  - `hasInstagram: place.instagram != null && place.instagram !== ""`
  - `whatsappStatus: place.whatsapp ? "verified" : (phone?.type === "mobile" ? "possible" : "unknown")`
- `supabase/functions/_shared/score-input.ts` — identical change (GooglePlace
  mapping / DB place row shape).

No `score.ts` rule change — v2.0.0 already weights email/instagram/whatsapp. This
means the parity vectors from Phase 1 stay valid.

## `enrich-discovery` edge function (new)

`supabase/functions/enrich-discovery/index.ts`. Input (zod union):

```ts
z.union([
  z.object({ searchId: z.string().uuid() }),
  z.object({ searchId: z.string().uuid(), placeId: z.string().uuid() }),
])
```

Flow:
1. `requireAuth`; `assertRateLimit(org, "enrich_request", ...)`.
2. Select candidate places: join `search_results sr` + `places p` on the search,
   `p.website_uri` present, `p.enriched_at is null OR p.enriched_at < now() -
   interval '30 days'`. If `placeId` given, restrict to it; else order by
   `sr.score desc` limit 25.
3. For each candidate (concurrency 5): `enrichFromWebsite({ website:
   p.website_uri })` (existing helper; 4 s timeout via its fetch). Map fields →
   `{ email, instagram, whatsapp }`.
4. Update `places` for that id: set the three columns (only when a value was
   found — additive, never null-out existing), `whatsapp_status = whatsapp ?
   'verified' : whatsapp_status`, `enriched_at = now()`, `enrichment_status =
   status`.
5. Re-score: build `ScoreInput` via `scoreInputFromPlace(updatedPlace,
   sr.distance_meters)` and `calculateScore`; update every `search_results` row
   for that place in this search with `score`, `temperature`,
   `score_breakdown`.
6. Return `{ enriched: <count>, status: "ok" }`.

Idempotent: re-running skips recently-enriched places; re-scoring is
deterministic.

## RPC + read path

- `get_search_discovery` — add `p.email`, `p.instagram`, `p.whatsapp` to the
  `returns table (...)` and the `select`. New migration (create-or-replace the
  function; it's already versioned in migrations).
- `DiscoveryResult` (`apps/web/src/repositories/types.ts`) — add `email: string
  | null`, `instagram: string | null`, `whatsapp: string | null`.
- Repo mapping (`getDiscovery` in `apps/web/src/repositories/supabase.ts`) — map
  the new columns.
- `discoveryToPreviewLead` (`apps/web/src/lib/discovery-preview.ts`) — map
  `email`, `instagram`, `whatsapp` from the result (they were `undefined`
  before; now real). The preview drawer's Informações tab already renders these
  (`?? "—"`), so they light up automatically.
- CSV: add email / instagram / whatsapp columns to `exportDiscoveryCSV`
  (`apps/web/src/lib/export.ts`) so exported discovery carries contact data.

## Triggers + refresh (frontend)

- `SearchRepository.enrichDiscovery(searchId, placeId?)` →
  `invokeFunction("enrich-discovery", { searchId, ...(placeId && { placeId }) })`.
  Add to the repo interface + supabase impl + demo (no-op).
- `useSearchMutation` — after a search reaches `completed`, fire
  `repo.enrichDiscovery(searchId)` **without awaiting** (fire-and-forget); errors
  swallowed (best-effort). Then let polling pick up updates.
- `useDiscoveryResults` — add `refetchInterval` that is active only for ~30 s
  after the current search completed (e.g. a `justCompletedAt` timestamp in the
  store, or a bounded interval that self-disables). Keep it simple: poll every
  5 s, stop after 6 polls. Deterministic, no realtime dependency.
- On-open (`DiscoveryCard` + `MapView` "Detalhes" / "Ver detalhes", and the
  preview open path): if the result has a website and no email/instagram/whatsapp
  yet, call `repo.enrichDiscovery(searchId, result.placeId)` and, on success,
  `queryClient.invalidateQueries(discoveryKeys.bySearch(searchId))` so the
  preview refreshes. Non-blocking to opening the drawer.

## Error Handling

- Scrape failure / SSRF-blocked / timeout → `enrichment_status` records it;
  `enriched_at` still set so we don't hammer the same dead site every search.
- `enrich-discovery` failures are best-effort: they never block search results
  or funnel actions. Client fire-and-forget swallows errors.
- Additive writes only: never overwrite a non-empty place column with null.

## Testing

- **Domain/edge `scoreInputFromPlace`:** place with `email`/`instagram` set →
  `hasEmail`/`hasInstagram` true; `whatsapp` set → `whatsappStatus === "verified"`.
  Extend `packages/domain/src/score-input.test.ts` (+ the `_shared` mirror is
  covered by its vector test — re-score path uses the same rule).
- **Re-score correctness:** a with-site place scored X at search time; after
  enrichment adding email+instagram, `calculateScore` returns X+15 (bun unit on
  the pure functions).
- **`discoveryToPreviewLead`:** maps email/instagram/whatsapp (extend the
  existing test).
- **`enrich-discovery`** logic is not runtime-verified in this checkout (no Deno
  locally, like `enrich-lead`); rely on typecheck + the shared pure-function
  tests. Note this in the plan.
- Run: `bun test`, `apps/web` `npm run typecheck` + `lint` + `build`.

## Rollout

- Migration via `supabase db push --linked`.
- Deploy: `supabase functions deploy enrich-discovery` (new) and re-deploy
  `execute-search` + `import-search-results` (they import the changed
  `_shared/score-input.ts`) via `--use-api`.
- Historical places have `enriched_at = null` → first re-search enriches them.

## Decomposition (task groups for the plan)

- **2a — Schema + scoring input:** places migration; `scoreInputFromPlace` reads
  enrichment (both mirrors); unit tests.
- **2b — `enrich-discovery` function:** top-N + single-place; scrape, persist,
  re-score.
- **2c — Read path:** RPC columns; `DiscoveryResult` + repo + preview adapter +
  CSV.
- **2d — Triggers/refresh:** repo method; search-complete fire-and-forget;
  bounded discovery polling; on-open enrich.

## Non-Goals / Follow-ups

- Phase 3: contact discovery for no-site businesses (social/Google lookup).
- Realtime (websocket) discovery updates — polling is enough here.
- `searches.status = 'enriching'` state machine — not needed with client-side
  bounded polling; could formalize later.
