# Zero-Google: OSM Place Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the platform to refresh place details with zero Google API calls, sourcing details from OpenStreetMap/Overpass behind the existing `USE_OSM_PLACES` flag.

**Architecture:** Mirror the codebase's existing strangler pattern. Add a tested `getPlaceDetails` to the Node/Bun `@leads/providers` Overpass adapter, then mirror it as `osmPlaceDetails` into the Deno edge-function module `supabase/functions/_shared/osm.ts`. Flag-route `refresh-place-details` to pick OSM vs Google, exactly like `create-search` already does for geocoding. Fields OSM cannot provide (rating, review count, opening hours, business status) are left undefined → persisted as `null`, never invented.

**Tech Stack:** TypeScript, Bun test (`bun:test`), Deno (Supabase Edge Functions), Overpass API, Postgres/PostGIS via Supabase.

## Global Constraints

- **Incremental, additive, non-destructive** — Google stays functional behind flags; remove nothing. (`docs/migration-plan.md` master rule)
- **Never invent data** — fields absent in OSM (`rating`, `userRatingCount`, `regularOpeningHours`, `businessStatus`, `addressComponents`) stay `undefined`/`null`.
- `bun run build` must stay green; no *new* lint/typecheck errors beyond pre-existing ones (`setRadius`, prettier — see `docs/current-architecture.md`).
- **Two-module mirror:** logic is unit-tested in `packages/providers` (Bun); `supabase/functions/_shared/osm.ts` is a hand-mirror (no Deno test harness in this checkout — matches the note already in that file's header).
- `provider_place_id` OSM format is `"<node|way|relation>/<id>"` (e.g. `"node/42"`), produced by `osmSearchBusinesses` and persisted verbatim by `execute-search/index.ts:230`.
- Overpass config via env: `OVERPASS_BASE_URL`, `OVERPASS_USER_AGENT`, `OVERPASS_TIMEOUT_MS`.

---

## File Structure

- `packages/providers/src/overpass.ts` — add `buildOverpassElementQuery()` + `OverpassPlacesProvider.getPlaceDetails()`. Reuses existing `mapElement()`.
- `packages/providers/src/overpass.test.ts` — add tests for the two new units.
- `supabase/functions/_shared/osm.ts` — add `buildOverpassElementQuery()` + `mapElementToPlace()` (extracted from `osmSearchBusinesses`) + `osmPlaceDetails()`.
- `supabase/functions/refresh-place-details/index.ts` — flag-route provider selection (line 32) + usage label (line 37).
- `apps/web/src/components/app/LeadDetailsDrawer.tsx` — gate the rating row by `env.useOsm`.
- `docs/migration-plan.md`, `docs/local-development.md`, `docs/GOOGLE_PLACES_SETUP.md` — doc updates.

---

## Task 1: `getPlaceDetails` in @leads/providers (tested)

**Files:**
- Modify: `packages/providers/src/overpass.ts`
- Test: `packages/providers/src/overpass.test.ts`

**Interfaces:**
- Consumes: existing `mapElement(el): BusinessCandidate | null`, `requestJson`, `OverpassConfig`, `OverpassElement` from the same file.
- Produces:
  - `buildOverpassElementQuery(providerPlaceId: string): string | null` — `null` when the id is not OSM-shaped.
  - `OverpassPlacesProvider.getPlaceDetails(externalId: string): Promise<BusinessCandidate | null>`

- [ ] **Step 1: Write the failing tests**

Append to `packages/providers/src/overpass.test.ts`:

```ts
import {
  buildOverpassElementQuery,
  buildOverpassQuery,
  mapElement,
  OverpassPlacesProvider,
} from "./overpass";

describe("buildOverpassElementQuery", () => {
  test("builds an element-by-id query for a node", () => {
    expect(buildOverpassElementQuery("node/42")).toContain("node(42);");
  });
  test("builds for way and relation", () => {
    expect(buildOverpassElementQuery("way/7")).toContain("way(7);");
    expect(buildOverpassElementQuery("relation/9")).toContain("relation(9);");
  });
  test("returns null for a non-OSM id (e.g. a Google place id)", () => {
    expect(buildOverpassElementQuery("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBeNull();
    expect(buildOverpassElementQuery("node/")).toBeNull();
    expect(buildOverpassElementQuery("42")).toBeNull();
  });
});

describe("OverpassPlacesProvider.getPlaceDetails", () => {
  const makeProvider = (fakeFetch: unknown) =>
    new OverpassPlacesProvider({
      baseUrl: "https://overpass.example/api/interpreter",
      userAgent: "leads-test/1.0",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

  test("fetches one element by id and maps it", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 42,
              lat: -30.03,
              lon: -51.21,
              tags: { name: "Clínica São José", amenity: "clinic", phone: "+55 51 3321-4567" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const c = (await makeProvider(fakeFetch).getPlaceDetails("node/42"))!;
    expect(c.externalId).toBe("node/42");
    expect(c.phone).toBe("+55 51 3321-4567");
    expect(c.category).toBe("clinic");
  });

  test("returns null when Overpass finds no element", async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    expect(await makeProvider(fakeFetch).getPlaceDetails("node/999")).toBeNull();
  });

  test("returns null for a non-OSM id without hitting the network", async () => {
    let called = false;
    const fakeFetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };
    expect(await makeProvider(fakeFetch).getPlaceDetails("ChIJxyz")).toBeNull();
    expect(called).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/providers && bun test src/overpass.test.ts`
Expected: FAIL — `buildOverpassElementQuery is not exported` / `getPlaceDetails is not a function`.

- [ ] **Step 3: Implement `buildOverpassElementQuery`**

Add to `packages/providers/src/overpass.ts` (after `buildOverpassQuery`, ~line 79):

```ts
/** "node/42" -> element-by-id Overpass query. null if not an OSM id. */
export function buildOverpassElementQuery(providerPlaceId: string, timeoutSec = 25): string | null {
  const m = /^(node|way|relation)\/(\d+)$/.exec(providerPlaceId.trim());
  if (!m) return null;
  const [, type, id] = m;
  return `[out:json][timeout:${timeoutSec}];\n${type}(${id});\nout center tags;`;
}
```

- [ ] **Step 4: Implement `getPlaceDetails`**

Add as a method inside `OverpassPlacesProvider` (after `searchBusinesses`, ~line 151):

```ts
  async getPlaceDetails(externalId: string): Promise<BusinessCandidate | null> {
    const ql = buildOverpassElementQuery(externalId);
    if (!ql) return null;
    const data = await requestJson<{ elements?: OverpassElement[] }>(
      {
        url: this.config.baseUrl,
        method: "POST",
        body: `data=${encodeURIComponent(ql)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
      {
        fetchImpl: this.config.fetchImpl,
        timeoutMs: this.config.timeoutMs ?? 30000,
        maxRetries: this.config.maxRetries ?? 2,
        userAgent: this.config.userAgent,
      },
    );
    const el = data.elements?.[0];
    return el ? mapElement(el) : null;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/providers && bun test src/overpass.test.ts`
Expected: PASS (all `buildOverpassElementQuery` + `getPlaceDetails` tests green, existing tests still green).

- [ ] **Step 6: Typecheck**

Run: `cd packages/providers && bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/providers/src/overpass.ts packages/providers/src/overpass.test.ts
git commit -m "feat(providers): Overpass getPlaceDetails by element id"
```

---

## Task 2: Mirror `osmPlaceDetails` into the edge-function module

**Files:**
- Modify: `supabase/functions/_shared/osm.ts`

**Interfaces:**
- Consumes: existing `env()`, `fetchJson()`, `OverpassEl`, `GooglePlace` (imported from `./google.ts`) in the same file.
- Produces:
  - `buildOverpassElementQuery(providerPlaceId: string, timeoutSec?: number): string | null`
  - `mapElementToPlace(el: OverpassEl): GooglePlace | null`
  - `osmPlaceDetails(providerPlaceId: string): Promise<GooglePlace | null>`

> No Bun/Deno test harness exists for this module in this checkout (see the file's header note). It is a faithful mirror of the Task 1 logic, verified by parity and by `bun run build`. Keep the mapping byte-identical in behavior to `mapElement` in `packages/providers`.

- [ ] **Step 1: Extract `mapElementToPlace` from `osmSearchBusinesses`**

In `supabase/functions/_shared/osm.ts`, add this helper above `osmSearchBusinesses` (~line 143). It is the exact body of the current `for` loop in `osmSearchBusinesses`:

```ts
/** Maps one Overpass element to a Google-Place-shaped object. null if unusable. */
export function mapElementToPlace(el: OverpassEl): GooglePlace | null {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat == null || lon == null) return null;
  const category =
    t.amenity || t.shop || t.healthcare || t.office || t.leisure || t.tourism || null;
  const address = [
    [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", "),
    t["addr:city"] || t["addr:suburb"] || "",
  ]
    .filter(Boolean)
    .join(" - ");
  return {
    id: `${el.type}/${el.id}`,
    displayName: { text: name },
    formattedAddress: address || undefined,
    location: { latitude: lat, longitude: lon },
    primaryType: category ?? undefined,
    types: category ? [category] : [],
    websiteUri: t.website || t["contact:website"] || undefined,
    nationalPhoneNumber: t.phone || t["contact:phone"] || undefined,
  };
}
```

- [ ] **Step 2: Refactor `osmSearchBusinesses` to use the helper (DRY, no behavior change)**

Replace the mapping block inside the `for (const el of data.elements ?? [])` loop (osm.ts:172-201) with:

```ts
  const seen = new Set<string>();
  const places: GooglePlace[] = [];
  for (const el of data.elements ?? []) {
    const place = mapElementToPlace(el);
    if (!place) continue;
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
    if (input.maxResults && places.length >= input.maxResults) break;
  }
  return { places };
```

- [ ] **Step 3: Add `buildOverpassElementQuery` + `osmPlaceDetails`**

Add after `osmSearchBusinesses`:

```ts
/** "node/42" -> element-by-id Overpass query. null if not an OSM id. */
export function buildOverpassElementQuery(providerPlaceId: string, timeoutSec = 25): string | null {
  const m = /^(node|way|relation)\/(\d+)$/.exec(providerPlaceId.trim());
  if (!m) return null;
  const [, type, id] = m;
  return `[out:json][timeout:${timeoutSec}];\n${type}(${id});\nout center tags;`;
}

/**
 * Place details via Overpass (element by id). Returns a Google-Place-shaped
 * object so refresh-place-details' update block is unchanged. Fields OSM lacks
 * (rating, userRatingCount, regularOpeningHours, businessStatus,
 * addressComponents) are left undefined -> persisted as null. Never invented.
 */
export async function osmPlaceDetails(providerPlaceId: string): Promise<GooglePlace | null> {
  const ql = buildOverpassElementQuery(providerPlaceId);
  if (!ql) return null;
  const base = env("OVERPASS_BASE_URL", "https://overpass-api.de/api/interpreter");
  const ua = env("OVERPASS_USER_AGENT", "leads-platform/1.0");
  const timeout = Number(env("OVERPASS_TIMEOUT_MS", "30000"));
  const data = await fetchJson<{ elements?: OverpassEl[] }>(
    base,
    {
      method: "POST",
      body: `data=${encodeURIComponent(ql)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": ua,
        Accept: "application/json",
      },
    },
    timeout,
  );
  const el = data.elements?.[0];
  return el ? mapElementToPlace(el) : null;
}
```

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: green; no new typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/osm.ts
git commit -m "feat(functions): mirror osmPlaceDetails + extract mapElementToPlace"
```

---

## Task 3: Flag-route `refresh-place-details` to OSM

**Files:**
- Modify: `supabase/functions/refresh-place-details/index.ts:30-38`

**Interfaces:**
- Consumes: `osmPlaceDetails` from Task 2 (dynamic import), existing `placeDetails` from `./google.ts`.
- Produces: no new exports.

> Deno edge functions have no unit-test harness in this checkout. This mirrors the flag-routing pattern already in `create-search/index.ts:71-74`. Verification is by code parity + the grep sanity check in Task 6.

- [ ] **Step 1: Replace the fetch line + usage label**

Replace lines 30-38 (`let refreshed = 0;` through the `recordUsage` call) with:

```ts
    const useOsm = Deno.env.get("USE_OSM_PLACES") === "true";
    let refreshed = 0;
    for (const place of stale ?? []) {
      const details = useOsm
        ? await (await import("../_shared/osm.ts")).osmPlaceDetails(place.provider_place_id)
        : await placeDetails(place.provider_place_id);
      if (!details) continue; // no OSM element (or non-OSM id) -> skip, don't count
      await recordUsage(ctx.adminClient, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: "place_details_request",
        provider: useOsm ? "overpass" : "google_places",
      });
```

(The existing `.update({...})` block and `refreshed++;` stay exactly as they are — every field already uses `?? null`, so OSM's undefined rating/hours/status become `null`.)

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: green; no new typecheck errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/refresh-place-details/index.ts
git commit -m "feat(functions): route refresh-place-details via OSM behind USE_OSM_PLACES"
```

---

## Task 4: Hide the rating row in the lead drawer under OSM

**Files:**
- Modify: `apps/web/src/components/app/LeadDetailsDrawer.tsx:272-274`

**Interfaces:**
- Consumes: `env.useOsm` from `apps/web/src/lib/env.ts` (already exported).
- Produces: none.

> `LeadCard.tsx:143` already self-hides rating via `lead.rating != null`, so no change there. Only the drawer's fixed "Nota / Avaliações" row renders `"— (0)"` in OSM mode; gate it.

- [ ] **Step 1: Confirm `env` is imported in the drawer**

Run: `grep -n "import.*env" apps/web/src/components/app/LeadDetailsDrawer.tsx`
Expected: an import of `env` from `@/lib/env`. If absent, add `import { env } from "@/lib/env";` alongside the other imports.

- [ ] **Step 2: Gate the rating InfoRow**

Replace lines 272-274:

```tsx
                <InfoRow icon={Star} label="Nota / Avaliações">
                  {lead.rating?.toFixed(1) ?? "—"} ({lead.reviewCount ?? 0})
                </InfoRow>
```

with:

```tsx
                {!env.useOsm && (
                  <InfoRow icon={Star} label="Nota / Avaliações">
                    {lead.rating?.toFixed(1) ?? "—"} ({lead.reviewCount ?? 0})
                  </InfoRow>
                )}
```

- [ ] **Step 3: Verify build + lint**

Run: `bun run build && bun run lint`
Expected: green; no new lint errors. (If `Star` becomes unused after gating, leave it — still used by the `>= 4.5` badge logic at line 106.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/LeadDetailsDrawer.tsx
git commit -m "feat(web): hide rating row in lead drawer under OSM mode"
```

---

## Task 5: Docs — mark place-details done, Google optional

**Files:**
- Modify: `docs/migration-plan.md`, `docs/local-development.md`, `docs/GOOGLE_PLACES_SETUP.md`

**Interfaces:** none.

- [ ] **Step 1: Update migration-plan checklist**

In `docs/migration-plan.md`, add under the OSM providers / integration section a line noting place-details now has an OSM path behind `USE_OSM_PLACES` (function `osmPlaceDetails`), completing zero-Google coverage. Match the file's existing checkbox style.

- [ ] **Step 2: Document OSM-only env in local-development**

In `docs/local-development.md`, add a short "Rodar sem Google (OSM-only)" subsection listing the secrets:

```
supabase secrets set USE_OSM_GEOCODER=true USE_OSM_PLACES=true USE_OSM_MAP_PROVIDER=true
```
and note `GOOGLE_MAPS_SERVER_KEY` / `VITE_GOOGLE_MAPS_BROWSER_KEY` are optional in this mode.

- [ ] **Step 3: Note Google is optional**

In `docs/GOOGLE_PLACES_SETUP.md`, add a one-line note at the top: Google is now optional — with `USE_OSM_*` flags enabled the platform runs fully on OpenStreetMap (geocoding, discovery, details, tiles).

- [ ] **Step 4: Commit**

```bash
git add docs/migration-plan.md docs/local-development.md docs/GOOGLE_PLACES_SETUP.md
git commit -m "docs: place-details OSM path + zero-Google run instructions"
```

---

## Task 6: Zero-Google sanity verification

**Files:** none (verification only).

- [ ] **Step 1: Grep — no unguarded Google call remains**

Run:
```bash
grep -rn "placeDetails\|textSearch\|nearbySearch\|geocode\b\|reverseGeocode" supabase/functions --include=*.ts | grep -v "_shared/google.ts" | grep -v "osm.ts"
```
Expected: every remaining Google call site (`create-search`, `execute-search`, `geocode-location`, `refresh-place-details`) is inside a `USE_OSM_* === "true" ? osm... : google...` branch. Confirm no bare Google call outside a flag branch.

- [ ] **Step 2: Confirm the kill-switch**

Read `supabase/functions/_shared/google.ts:58-62`. Confirm `serverKey()` throws `PROVIDER_UNAVAILABLE` when `GOOGLE_MAPS_SERVER_KEY` is absent — so any accidental Google call in OSM mode fails loudly rather than silently.

- [ ] **Step 3: Full build + test**

Run: `bun run build && bun test`
Expected: build green; all tests pass (including the new Task 1 tests); no new lint/typecheck errors beyond documented pre-existing ones.

- [ ] **Step 4: Manual smoke (requires deployed functions + OSM secrets)**

With `USE_OSM_GEOCODER=true`, `USE_OSM_PLACES=true`, and `GOOGLE_MAPS_SERVER_KEY` empty:
1. Run a radar search → leads import (uses `osmGeocode` + `osmSearchBusinesses`).
2. Open a lead, trigger detail refresh → succeeds via `osmPlaceDetails`, no `PROVIDER_UNAVAILABLE`.
3. Confirm rating/hours show empty/hidden, phone/website/address populated.

---

## Self-Review

- **Spec coverage:** osmPlaceDetails (Task 1+2) ✓; flag-route refresh-place-details (Task 3) ✓; round-trip provider_place_id verified as zero-code (Global Constraints + Task 6 §1) ✓; UI gate (Task 4) ✓; flags ops step (Task 5 §2) ✓; docs (Task 5) ✓; tests (Task 1) ✓; kill-switch reuse (Task 6 §2) ✓; success criteria (Task 6) ✓.
- **Placeholders:** none — all code shown in full.
- **Type consistency:** `buildOverpassElementQuery` returns `string | null` in both modules; `getPlaceDetails`→`BusinessCandidate | null` (providers), `osmPlaceDetails`→`GooglePlace | null` (edge, matches `placeDetails` return); `mapElementToPlace`→`GooglePlace | null`. `provider_place_id` regex `^(node|way|relation)\/(\d+)$` identical in both modules.
