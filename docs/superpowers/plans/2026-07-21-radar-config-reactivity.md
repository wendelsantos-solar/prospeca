# Radar Config Reactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Radar (`/app/mapa`) config feel live — the radius circle redraws while dragging, filter chips show live counts, and stale results are flagged with a "Buscar nesta área" affordance — without ever auto-firing the paid Google Places search.

**Architecture:** Move the search config out of `SearchForm`'s local `useState` into a shared zustand store (`useSearchDraftStore`) so `MapView`, the search button, and a floating pill can all observe it. Cheap operations (draw circle, narrow radius, narrow presence, filter counts) run client-side and instantly; expensive ones (new niche/location, widen radius/presence, pan-to-search) mark the draft "dirty" and require an explicit click.

**Tech Stack:** React + TypeScript, zustand (persist middleware), TanStack Query, Leaflet + leaflet.markercluster, Tailwind. Tests via `bun test` (built-in, zero-install) for pure logic and store modules. UI wiring verified via `bun run typecheck` + manual run (no React test harness exists in this repo).

## Global Constraints

- Package manager: **bun** (monorepo, `bun@1.3.14`). Run commands from `apps/web`.
- Radius scale is fixed: `RADIUS_OPTIONS = [1, 5, 10, 20, 30, 50, 100]` (`lib/constants.ts:10`). Compare radius by **value**, never by slider index.
- `PresenceFilter = "no-website" | "with-website" | "all"` (`types/index.ts:4`).
- Never trigger `runSearch()` as a side effect of a config change — only on explicit button/pill click.
- The paid search source is Google Places via Supabase Edge Function `execute-search`; the mutation lives in `useSearchMutation.ts` and must not be called reactively.
- Follow existing store patterns in `stores/index.ts` (zustand `create` + `persist` + `createJSONStorage(safeStorage)`).
- Typecheck must pass after every task: `bun run typecheck`.

---

### Task 1: Extract haversine into a testable `lib/geo.ts`

A `haversine` already exists privately in `services/index.ts:27-36`. Extract it into a shared, tested module so the radius logic (Task 6) and dirty logic (Task 4) can reuse it. DRY.

**Files:**
- Create: `apps/web/src/lib/geo.ts`
- Create: `apps/web/src/lib/geo.test.ts`
- Modify: `apps/web/src/services/index.ts:27-36` (replace private `haversine` with import)

**Interfaces:**
- Produces: `export function distanceKm(a: LatLng, b: LatLng): number` where `export interface LatLng { lat: number; lng: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/geo.test.ts
import { test, expect } from "bun:test";
import { distanceKm } from "./geo";

test("distanceKm is 0 for the same point", () => {
  expect(distanceKm({ lat: -30.03, lng: -51.22 }, { lat: -30.03, lng: -51.22 })).toBe(0);
});

test("distanceKm ~1.11km per 0.01 degree of latitude", () => {
  const d = distanceKm({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
  expect(d).toBeGreaterThan(1.1);
  expect(d).toBeLessThan(1.12);
});

test("distanceKm Rio to São Paulo is ~360km", () => {
  const d = distanceKm({ lat: -22.9068, lng: -43.1729 }, { lat: -23.5505, lng: -46.6333 });
  expect(d).toBeGreaterThan(355);
  expect(d).toBeLessThan(365);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/geo.test.ts`
Expected: FAIL — `Cannot find module './geo'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/geo.ts
export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in kilometers between two coordinates. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/geo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Reuse in services (DRY)**

Replace the private `haversine` in `services/index.ts`. Add near the top imports:

```ts
import { distanceKm } from "@/lib/geo";
```

Delete lines `services/index.ts:27-36` (the `function haversine(...)` block) and replace each call site `haversine(lat1, lng1, lat2, lng2)` with `distanceKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })`. Find call sites with:

Run: `cd apps/web && rg -n 'haversine\(' src/services/index.ts`

- [ ] **Step 6: Verify typecheck + tests**

Run: `cd apps/web && bun run typecheck && bun test src/lib/geo.test.ts`
Expected: typecheck clean, 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/geo.ts apps/web/src/lib/geo.test.ts apps/web/src/services/index.ts
git commit -m "refactor(radar): extract haversine into tested lib/geo.ts"
```

---

### Task 2: Add `useSearchDraftStore`

Single source of truth for the in-progress config. Not persisted (results live in `useLeadsStore.currentSearch`).

**Files:**
- Modify: `apps/web/src/stores/index.ts` (add new store after `useLocationStore`, ~line 455)
- Create: `apps/web/src/stores/searchDraft.test.ts`

**Interfaces:**
- Consumes: `Search`, `PresenceFilter` (from `@/types`), `RADIUS_OPTIONS` (`@/lib/constants`).
- Produces:
  ```ts
  export interface SearchDraft {
    niche: string;
    location: string;
    coords: { lat: number; lng: number };
    radiusKm: number;
    presence: PresenceFilter;
  }
  export const useSearchDraftStore: (…) => {
    draft: SearchDraft;
    setDraft: (patch: Partial<SearchDraft>) => void;
    resetDraftTo: (search: Search) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/stores/searchDraft.test.ts
import { test, expect, beforeEach } from "bun:test";
import { useSearchDraftStore } from "./index";
import type { Search } from "@/types";

const initial = useSearchDraftStore.getState().draft;
beforeEach(() => useSearchDraftStore.setState({ draft: { ...initial } }));

test("setDraft patches a single field", () => {
  useSearchDraftStore.getState().setDraft({ radiusKm: 50 });
  expect(useSearchDraftStore.getState().draft.radiusKm).toBe(50);
  expect(useSearchDraftStore.getState().draft.niche).toBe(initial.niche);
});

test("resetDraftTo hydrates draft from a committed Search", () => {
  const search = {
    id: "s1", niche: "Padaria", location: "Centro, POA",
    latitude: -30.03, longitude: -51.22, radiusKm: 20, presence: "all",
    createdAt: "", totalFound: 0, enrichedCount: 0, addedToPipeline: 0, contactsFound: 0,
  } satisfies Search;
  useSearchDraftStore.getState().resetDraftTo(search);
  const d = useSearchDraftStore.getState().draft;
  expect(d).toEqual({
    niche: "Padaria", location: "Centro, POA",
    coords: { lat: -30.03, lng: -51.22 }, radiusKm: 20, presence: "all",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/stores/searchDraft.test.ts`
Expected: FAIL — `useSearchDraftStore` is not exported.

- [ ] **Step 3: Implement the store**

Add to `stores/index.ts` (after `useLocationStore`, before `applyPresenceFilter`):

```ts
// ---- Search draft (rascunho da config do Radar; NÃO persistido) ----
export interface SearchDraft {
  niche: string;
  location: string;
  coords: { lat: number; lng: number };
  radiusKm: number;
  presence: PresenceFilter;
}
interface SearchDraftState {
  draft: SearchDraft;
  setDraft: (patch: Partial<SearchDraft>) => void;
  resetDraftTo: (search: Search) => void;
}
const initialDraft: SearchDraft = {
  niche: "Clínica médica",
  location: "Porto Alegre, Rio Grande do Sul",
  coords: { lat: -30.0346, lng: -51.2177 },
  radiusKm: 10,
  presence: "no-website",
};
export const useSearchDraftStore = create<SearchDraftState>()((set) => ({
  draft: initialDraft,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  resetDraftTo: (search) =>
    set({
      draft: {
        niche: search.niche,
        location: search.location,
        coords: { lat: search.latitude, lng: search.longitude },
        radiusKm: search.radiusKm,
        presence: search.presence,
      },
    }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/stores/searchDraft.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/stores/index.ts apps/web/src/stores/searchDraft.test.ts
git commit -m "feat(radar): add useSearchDraftStore as single source of truth for config"
```

---

### Task 3: Refactor `SearchForm` to consume the draft store

Replace local `useState` config with the store. Behavior unchanged from the user's view; this just makes config observable app-wide.

**Files:**
- Modify: `apps/web/src/components/app/SearchForm.tsx`

**Interfaces:**
- Consumes: `useSearchDraftStore` (Task 2), `useLeadsStore.setLeads` which must also call `resetDraftTo` (added in Step 3).

- [ ] **Step 1: Wire `setLeads` → `resetDraftTo`**

In `stores/index.ts`, inside `setLeads` (`stores/index.ts:186-201`), after the `set(...)` call, sync the draft so "dirty" clears on a completed search. Add at the end of the `setLeads` body:

```ts
        useSearchDraftStore.getState().resetDraftTo(search);
```

(Place it after the `set((s) => ({...}))` block, still inside `setLeads`.)

- [ ] **Step 2: Replace local state in SearchForm**

In `SearchForm.tsx`, remove the local config `useState` lines (`84-91`, `99`) and the `defaultPresence`/`defaultRadius` slider-sync effect (`87-97`). Replace with store-derived values:

```ts
  const draft = useSearchDraftStore((s) => s.draft);
  const setDraft = useSearchDraftStore((s) => s.setDraft);
  const niche = draft.niche;
  const location = draft.location;
  const locCoords = draft.coords;
  const presence = draft.presence;
  const radius = draft.radiusKm;
  const sliderIndex = Math.max(0, RADIUS_OPTIONS.indexOf(radius as (typeof RADIUS_OPTIONS)[number]));
```

Add the import: `import { useSearchDraftStore } from "@/stores";` (extend the existing `@/stores` import line).

- [ ] **Step 3: Replace every setter call**

Map old setters to `setDraft`:

| Old | New |
|---|---|
| `setNiche(v)` | `setDraft({ niche: v })` |
| `setLocation(v)` | `setDraft({ location: v })` |
| `setLocCoords({ lat, lng })` | `setDraft({ coords: { lat, lng } })` |
| `setPresence(v)` | `setDraft({ presence: v })` |
| `setSliderIndex(i)` | `setDraft({ radiusKm: RADIUS_OPTIONS[i]! })` |

Find every occurrence: `rg -n 'setNiche|setLocation|setLocCoords|setPresence|setSliderIndex' src/components/app/SearchForm.tsx` and replace each. Note: the `CommandInput` for niche uses `onValueChange={setNiche}` → change to `onValueChange={(v) => setDraft({ niche: v })}`. The location `CommandInput` `onValueChange={setLocation}` → `onValueChange={(v) => setDraft({ location: v })}`. The slider `onValueChange={(v) => setSliderIndex(v[0]!)}` → `onValueChange={(v) => setDraft({ radiusKm: RADIUS_OPTIONS[v[0]!]! })}`.

`runSearch` reads `niche`/`location`/`locCoords`/`radius`/`presence` locals — these now come from `draft`, so its body is unchanged.

- [ ] **Step 4: Update the global-event effect**

The mount effect (`SearchForm.tsx:139-184`) hydrates from `lastLocation` and handles `suggest-search`/`geo-located`. Replace its `setLocation`/`setLocCoords`/`setNiche`/`setPresence`/`setSliderIndex` calls with `setDraft` patches. For `onSuggest`, batch into one patch:

```ts
    const onSuggest = (e: Event) => {
      const d = (e as CustomEvent<SuggestSearchDetail>).detail;
      const radiusKm = d.radiusKm ?? draft.radiusKm;
      setDraft({
        niche: d.niche, location: d.location,
        coords: { lat: d.lat, lng: d.lng }, presence: d.presence, radiusKm,
      });
      runSearch({
        niche: d.niche, location: d.location,
        latitude: d.lat, longitude: d.lng, presence: d.presence, radiusKm,
      });
    };
```

For the `lastLocation` hydration at the top of the effect:

```ts
    const last = useLocationStore.getState().lastLocation;
    if (last) setDraft({ location: last.label, coords: { lat: last.lat, lng: last.lng } });
```

Keep `runSearch` in `onSuggest`'s dependency-free effect as-is (the eslint-disable comment stays).

- [ ] **Step 5: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Expected: no errors.

Manual: `bun run dev`, open `/app/mapa`. Confirm: niche/location/radius/presence controls still work, "Buscar empresas" still searches, results still render. No behavior change yet.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app/SearchForm.tsx apps/web/src/stores/index.ts
git commit -m "refactor(radar): SearchForm reads config from useSearchDraftStore"
```

---

### Task 4: Dirty classifier `lib/search-dirty.ts`

Pure function classifying the draft vs the committed search per the spec's decision table.

**Files:**
- Create: `apps/web/src/lib/search-dirty.ts`
- Create: `apps/web/src/lib/search-dirty.test.ts`

**Interfaces:**
- Consumes: `SearchDraft` (`@/stores`), `Search`, `PresenceFilter` (`@/types`), `distanceKm` (`@/lib/geo`).
- Produces:
  ```ts
  export type DirtyReason = "none" | "niche" | "location" | "radius-up" | "presence-wider";
  export function classifyDirty(draft: SearchDraft, current: Search | null): {
    dirty: boolean;         // true → needs a paid re-search
    reason: DirtyReason;
    clientOnly: boolean;    // true → change is satisfiable client-side (radius↓ / presence stricter)
  }
  ```

Presence breadth ordering (wider = more results): `"no-website" (1) < "with-website" (1) < "all" (2)`. Only `all` is strictly wider than the single-kind filters; switching between `no-website` and `with-website` is neither narrower nor wider of the same set → treat as **dirty** (`presence-wider`) because the server returned only one kind. Encode as: a change to a different presence value is client-satisfiable ONLY when the new value's result set is a subset of the current one, i.e. current `all` → any specific kind. Everything else that changes presence is dirty.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/search-dirty.test.ts
import { test, expect } from "bun:test";
import { classifyDirty } from "./search-dirty";
import type { Search } from "@/types";
import type { SearchDraft } from "@/stores";

const current: Search = {
  id: "s1", niche: "Clínica", location: "POA",
  latitude: -30.03, longitude: -51.22, radiusKm: 30, presence: "all",
  createdAt: "", totalFound: 0, enrichedCount: 0, addedToPipeline: 0, contactsFound: 0,
};
const base: SearchDraft = {
  niche: "Clínica", location: "POA",
  coords: { lat: -30.03, lng: -51.22 }, radiusKm: 30, presence: "all",
};

test("identical draft is not dirty", () => {
  expect(classifyDirty(base, current)).toEqual({ dirty: false, reason: "none", clientOnly: false });
});
test("no current search → never dirty", () => {
  expect(classifyDirty(base, null).dirty).toBe(false);
});
test("niche change is dirty", () => {
  expect(classifyDirty({ ...base, niche: "Padaria" }, current)).toMatchObject({ dirty: true, reason: "niche" });
});
test("moving center is dirty (location)", () => {
  expect(classifyDirty({ ...base, coords: { lat: -25, lng: -49 } }, current)).toMatchObject({ dirty: true, reason: "location" });
});
test("radius down is client-only, not dirty", () => {
  expect(classifyDirty({ ...base, radiusKm: 10 }, current)).toMatchObject({ dirty: false, clientOnly: true });
});
test("radius up is dirty", () => {
  expect(classifyDirty({ ...base, radiusKm: 50 }, current)).toMatchObject({ dirty: true, reason: "radius-up" });
});
test("all → no-website is client-only (subset)", () => {
  expect(classifyDirty({ ...base, presence: "no-website" }, current)).toMatchObject({ dirty: false, clientOnly: true });
});
test("no-website → all is dirty (wider)", () => {
  const cur = { ...current, presence: "no-website" as const };
  expect(classifyDirty({ ...base, presence: "all" }, cur)).toMatchObject({ dirty: true, reason: "presence-wider" });
});
test("no-website → with-website is dirty (different set)", () => {
  const cur = { ...current, presence: "no-website" as const };
  expect(classifyDirty({ ...base, presence: "with-website" }, cur)).toMatchObject({ dirty: true, reason: "presence-wider" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/search-dirty.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/search-dirty.ts
import type { Search, PresenceFilter } from "@/types";
import type { SearchDraft } from "@/stores";
import { distanceKm } from "@/lib/geo";

export type DirtyReason = "none" | "niche" | "location" | "radius-up" | "presence-wider";

// Coordinates closer than this are treated as the same center (rounding noise).
const SAME_CENTER_KM = 0.05;

// A presence change is client-satisfiable only when the new result set is a
// subset of the committed one. The only widening-safe case: current "all"
// (has every business) narrowed to a specific kind.
function presenceIsSubset(current: PresenceFilter, next: PresenceFilter): boolean {
  if (current === next) return true;
  return current === "all"; // all ⊇ {no-website, with-website}
}

export function classifyDirty(
  draft: SearchDraft,
  current: Search | null,
): { dirty: boolean; reason: DirtyReason; clientOnly: boolean } {
  if (!current) return { dirty: false, reason: "none", clientOnly: false };

  if (draft.niche.trim() !== current.niche.trim())
    return { dirty: true, reason: "niche", clientOnly: false };

  const moved =
    distanceKm(draft.coords, { lat: current.latitude, lng: current.longitude }) > SAME_CENTER_KM;
  if (moved || draft.location.trim() !== current.location.trim())
    return { dirty: true, reason: "location", clientOnly: false };

  if (draft.radiusKm > current.radiusKm)
    return { dirty: true, reason: "radius-up", clientOnly: false };

  if (draft.presence !== current.presence) {
    if (presenceIsSubset(current.presence, draft.presence))
      return { dirty: false, reason: "none", clientOnly: true };
    return { dirty: true, reason: "presence-wider", clientOnly: false };
  }

  // Only remaining diff is radius↓ → client-satisfiable.
  const clientOnly = draft.radiusKm < current.radiusKm;
  return { dirty: false, reason: "none", clientOnly };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/search-dirty.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/search-dirty.ts apps/web/src/lib/search-dirty.test.ts
git commit -m "feat(radar): dirty classifier for draft vs committed search"
```

---

### Task 5: Live radius circle + dim out-of-radius markers in MapView

Draw a "draft circle" from the draft config whenever it differs from `currentSearch`, so dragging the slider redraws instantly (cheap, no search).

**Files:**
- Modify: `apps/web/src/components/app/MapView.tsx`

**Interfaces:**
- Consumes: `useSearchDraftStore` (Task 2), `distanceKm` (Task 1).

- [ ] **Step 1: Subscribe to the draft**

In `MapView.tsx`, add near the other store hooks (`MapView.tsx:71-76`):

```ts
  const draft = useSearchDraftStore((s) => s.draft);
```

Extend the `@/stores` import to include `useSearchDraftStore`. Import `distanceKm`: `import { distanceKm } from "@/lib/geo";`.

- [ ] **Step 2: Add a draft-circle effect**

The committed circle is drawn from `currentSearch` (`MapView.tsx:136-161`). Add a new effect that overrides the circle radius/center live from the draft. Add after the `previewLocation` effect (`MapView.tsx:189`):

```ts
  // Live draft circle: redraws while the user drags the radius slider / edits
  // location, before any (paid) search runs. Cheap, client-only.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showCircle) return;
    const center: [number, number] = [draft.coords.lat, draft.coords.lng];
    if (circleRef.current) {
      circleRef.current.setLatLng(center);
      circleRef.current.setRadius(draft.radiusKm * 1000);
    } else {
      circleRef.current = L.circle(center, {
        radius: draft.radiusKm * 1000,
        color: "oklch(0.58 0.14 155)",
        fillColor: "oklch(0.58 0.14 155)",
        fillOpacity: 0.06,
        weight: 1.5,
      }).addTo(map);
    }
  }, [draft.coords.lat, draft.coords.lng, draft.radiusKm, showCircle]);
```

Note: this makes the circle follow the draft. The committed-search and preview effects still set the initial circle; this one keeps it in sync with live edits. Verify no double-circle: since all three reuse `circleRef.current` and call `setRadius`/`setLatLng` or recreate, the ref is shared. If a double appears in manual test, the fix is to remove the `L.circle` creation from the `previewLocation` effect and let this effect own creation — note that during review.

- [ ] **Step 3: Dim markers outside the draft radius**

In the marker-building effect (`MapView.tsx:191-241`), after computing each marker, set opacity based on whether the lead is within the draft radius. Inside the `leads.forEach((l) => { ... })` loop, after `const m = L.marker(...)`, add:

```ts
      const within = distanceKm(draft.coords, { lat: l.latitude, lng: l.longitude }) <= draft.radiusKm;
      m.setOpacity(within ? 1 : 0.25);
```

Add `draft.coords.lat`, `draft.coords.lng`, `draft.radiusKm` to that effect's dependency array (currently `[leads, focusedId, setFocused, setDetails, moveMutation]`).

- [ ] **Step 4: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Manual: `bun run dev` → `/app/mapa`, run a search, then drag the radius slider. The circle must resize live; markers outside the new radius fade to 25% opacity. No network request fires while dragging (check DevTools Network).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app/MapView.tsx
git commit -m "feat(radar): live radius circle + dim out-of-radius markers"
```

---

### Task 6: Live radius count under the slider

Show `~N empresas neste raio` beneath the slider, recomputed as the draft radius/center changes, over the already-loaded leads.

**Files:**
- Modify: `apps/web/src/components/app/SearchForm.tsx`

**Interfaces:**
- Consumes: `useLeadsStore.leads`, `distanceKm` (Task 1), `draft` (Task 2).

- [ ] **Step 1: Compute the count**

In `SearchForm.tsx`, add near the top of the component body:

```ts
  const leads = useLeadsStore((s) => s.leads);
  const leadsInRadius = useMemo(
    () =>
      leads.filter(
        (l) => distanceKm(draft.coords, { lat: l.latitude, lng: l.longitude }) <= draft.radiusKm,
      ).length,
    [leads, draft.coords.lat, draft.coords.lng, draft.radiusKm],
  );
```

Add imports: `useMemo` from react (extend line 1), `import { distanceKm } from "@/lib/geo";`.

- [ ] **Step 2: Render the count**

Under the slider block, after the `RADIUS_OPTIONS.map` labels row (`SearchForm.tsx:301-305`), add:

```tsx
        {leads.length > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            ~{leadsInRadius} de {leads.length} empresas neste raio
          </p>
        )}
```

- [ ] **Step 3: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Manual: after a search, dragging the radius down lowers the count live; dragging up (beyond the searched radius) shows the count capped at what's loaded (correct — widening needs a re-search, handled in Task 9).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/SearchForm.tsx
git commit -m "feat(radar): live lead count under radius slider"
```

---

### Task 7: Live counts on filter chips

Each quick-filter chip shows how many currently-loaded leads match it.

**Files:**
- Create: `apps/web/src/lib/filter-counts.ts`
- Create: `apps/web/src/lib/filter-counts.test.ts`
- Modify: `apps/web/src/components/app/Filters.tsx` (the `QuickFilters` component, lines 39-63)

**Interfaces:**
- Consumes: `Lead`, `LeadFilters` (`@/types`), `QUICK_FILTERS`, `applyFilters` (`@/lib/filters`).
- Produces: `export function quickFilterCounts(leads: Lead[], active: LeadFilters): Record<string, number>` — for each chip id, the count of leads that would remain if that chip were toggled on together with the currently-active filters.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/filter-counts.test.ts
import { test, expect } from "bun:test";
import { quickFilterCounts } from "./filter-counts";
import type { Lead } from "@/types";

const lead = (over: Partial<Lead>): Lead =>
  ({
    id: "x", companyName: "", category: "", address: "", city: "", state: "",
    latitude: 0, longitude: 0, distanceKm: 0, hasWebsite: false, score: 50,
    temperature: "cold", stage: "new", discoveredAt: "", notes: [], activities: [], timeline: [],
    ...over,
  }) as Lead;

test("counts leads matching each chip over the active filter set", () => {
  const leads = [
    lead({ whatsapp: "1", temperature: "hot" }),
    lead({ whatsapp: "2", temperature: "cold" }),
    lead({ temperature: "hot" }),
  ];
  const counts = quickFilterCounts(leads, { quick: [] });
  expect(counts.whatsapp).toBe(2);
  expect(counts.hot).toBe(2);
});

test("counts respect already-active filters", () => {
  const leads = [
    lead({ whatsapp: "1", temperature: "hot" }),
    lead({ whatsapp: "2", temperature: "cold" }),
  ];
  const counts = quickFilterCounts(leads, { quick: ["hot"] });
  expect(counts.whatsapp).toBe(1); // only the hot+whatsapp lead
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/filter-counts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/web/src/lib/filter-counts.ts
import type { Lead, LeadFilters } from "@/types";
import { QUICK_FILTERS, applyFilters } from "@/lib/filters";

/**
 * For each quick-filter chip, the number of leads that would remain if that
 * chip were toggled ON alongside the currently-active filters. Already-active
 * chips report the current filtered count.
 */
export function quickFilterCounts(leads: Lead[], active: LeadFilters): Record<string, number> {
  const out: Record<string, number> = {};
  for (const chip of QUICK_FILTERS) {
    const quick = active.quick.includes(chip.id)
      ? active.quick
      : [...active.quick, chip.id];
    out[chip.id] = applyFilters(leads, { ...active, quick }).length;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/filter-counts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `QuickFilters`**

In `Filters.tsx`, modify the `QuickFilters` component (lines 39-63) to compute and show counts:

```tsx
export function QuickFilters() {
  const filters = useLeadsStore((s) => s.filters);
  const leads = useLeadsStore((s) => s.leads);
  const toggle = useLeadsStore((s) => s.toggleQuickFilter);
  const counts = useMemo(() => quickFilterCounts(leads, filters), [leads, filters]);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtros rápidos">
      {QUICK_FILTERS.map((f) => {
        const active = filters.quick.includes(f.id);
        return (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:border-primary/60 hover:text-foreground",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">({counts[f.id] ?? 0})</span>
          </button>
        );
      })}
    </div>
  );
}
```

Add import at top of `Filters.tsx`: `import { quickFilterCounts } from "@/lib/filter-counts";` (`useMemo` is already imported, line 35).

- [ ] **Step 6: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck && bun test src/lib/filter-counts.test.ts`
Manual: chips show live counts, e.g. `WhatsApp (24)`. Toggling one chip updates the others' counts.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/filter-counts.ts apps/web/src/lib/filter-counts.test.ts apps/web/src/components/app/Filters.tsx
git commit -m "feat(radar): live counts on quick-filter chips"
```

---

### Task 8: Empty state when filters zero the list

**Files:**
- Modify: the leads list container. Locate it: `rg -l 'applyFilters|useLeadsList' apps/web/src/components/app apps/web/src/routes | head`. The primary consumer is likely `app.mapa.tsx` / a list panel; confirm which renders the filtered array.

**Interfaces:**
- Consumes: the filtered leads array already computed in the list component.

- [ ] **Step 1: Locate the filtered-list render**

Run: `cd apps/web && rg -n 'applyFilters|\.length === 0|Nenhum' src/routes/app.mapa.tsx src/components/app/LeadCard.tsx src/hooks/useLeadsQuery.ts`
Identify where the filtered array is mapped to cards and whether an empty branch exists.

- [ ] **Step 2: Add an empty-state branch**

Where the filtered list renders (in the component that owns the filtered array), add, before the `.map`:

```tsx
{filtered.length === 0 && leads.length > 0 && (
  <div className="grid place-items-center gap-2 p-8 text-center">
    <p className="text-sm font-medium">Nenhum lead com esses filtros</p>
    <button
      onClick={() => clearFilters()}
      className="text-xs font-medium text-primary hover:underline"
    >
      Afrouxar os filtros
    </button>
  </div>
)}
```

Wire `clearFilters` from `useLeadsStore((s) => s.clearFilters)` if not already present, and `leads` from `useLeadsStore((s) => s.leads)`. Use the actual variable names found in Step 1 for the filtered array (`filtered` is a placeholder for whatever it's called there).

- [ ] **Step 3: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Manual: apply a filter combo that matches nothing → empty state + "Afrouxar os filtros" clears filters.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat(radar): empty state when filters exclude all leads"
```

---

### Task 9: Dirty button + `RadarPill` (buscar nesta área)

The flagship UX: signal stale results and offer an explicit re-search, including pan-to-search.

**Files:**
- Create: `apps/web/src/hooks/useIsDirty.ts`
- Create: `apps/web/src/components/app/RadarPill.tsx`
- Modify: `apps/web/src/components/app/SearchForm.tsx` (dirty button style)
- Modify: `apps/web/src/components/app/MapView.tsx` (track map center → draft, render `RadarPill`)

**Interfaces:**
- Consumes: `classifyDirty` (Task 4), `useSearchDraftStore`, `useLeadsStore.currentSearch`/`searching`.
- Produces: `export function useIsDirty(): { dirty: boolean; reason: DirtyReason }`.

- [ ] **Step 1: Create the `useIsDirty` hook**

```ts
// apps/web/src/hooks/useIsDirty.ts
import { useSearchDraftStore, useLeadsStore } from "@/stores";
import { classifyDirty, type DirtyReason } from "@/lib/search-dirty";

export function useIsDirty(): { dirty: boolean; reason: DirtyReason } {
  const draft = useSearchDraftStore((s) => s.draft);
  const current = useLeadsStore((s) => s.currentSearch);
  const { dirty, reason } = classifyDirty(draft, current);
  return { dirty, reason };
}
```

- [ ] **Step 2: Dirty button style in SearchForm**

In `SearchForm.tsx`, import `useIsDirty` and derive:

```ts
  const { dirty } = useIsDirty();
  const hasResults = useLeadsStore((s) => s.currentSearch) != null;
```

Change the search button (`SearchForm.tsx:339-347`) to reflect dirty state:

```tsx
      <Button
        onClick={() => runSearch()}
        disabled={loading}
        size="lg"
        className={cn(
          "w-full gap-2 shadow-elegant",
          dirty && hasResults && "bg-amber-500 hover:bg-amber-600 text-white",
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading
          ? "Buscando empresas..."
          : dirty && hasResults
            ? "Atualizar busca"
            : "Buscar empresas"}
      </Button>
```

(`cn` is already imported, line 16.)

- [ ] **Step 3: Track map center into the draft on pan**

In `MapView.tsx`, extend the existing `moveend` handler (`MapView.tsx:115-123`). It currently only recounts visible markers. Add center-sync so panning marks the draft location dirty:

```ts
      const setDraft = useSearchDraftStore.getState().setDraft;
      const updateVisible = () => {
        const bounds = map.getBounds();
        let count = 0;
        markersRef.current.forEach((m) => {
          if (bounds.contains(m.getLatLng())) count++;
        });
        setVisibleCount(count);
      };
      const syncCenterToDraft = () => {
        const c = map.getCenter();
        setDraft({ coords: { lat: c.lat, lng: c.lng } });
      };
      map.on("moveend zoomend", updateVisible);
      map.on("moveend", syncCenterToDraft);
```

Important: to avoid a feedback loop, the committed-search effect (`MapView.tsx:136-161`) calls `map.setView(...)`, which fires `moveend`. That's acceptable — it sets the draft coords to the committed center, which `classifyDirty` treats as not-moved (within `SAME_CENTER_KM`). Do NOT add `draft.coords` to that effect's deps.

- [ ] **Step 4: Create `RadarPill`**

```tsx
// apps/web/src/components/app/RadarPill.tsx
import { useIsDirty } from "@/hooks/useIsDirty";
import { useLeadsStore } from "@/stores";
import { Search } from "lucide-react";

const REASON_LABEL: Record<string, string> = {
  niche: "Nicho mudou",
  location: "Área mudou",
  "radius-up": "Raio aumentou",
  "presence-wider": "Filtro ampliado",
};

/** Floating pill over the map: appears when results are stale. */
export function RadarPill({ onSearch }: { onSearch: () => void }) {
  const { dirty, reason } = useIsDirty();
  const searching = useLeadsStore((s) => s.searching);
  const hasResults = useLeadsStore((s) => s.currentSearch) != null;
  if (!dirty || !hasResults || searching) return null;
  return (
    <div className="absolute left-1/2 top-3 z-[400] -translate-x-1/2">
      <button
        onClick={onSearch}
        className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-elevated hover:bg-amber-600"
      >
        <Search className="h-3.5 w-3.5" />
        Buscar nesta área
        <span className="opacity-80">· {REASON_LABEL[reason] ?? "atualizar"}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Render `RadarPill` in MapView and wire the search trigger**

The paid search lives in `SearchForm` via `runSearch`. The cleanest bridge that matches the existing pattern (`SearchForm.tsx:172` listens for `retry-search`) is a window event. Add a `radar-search` listener in `SearchForm`'s mount effect:

```ts
    const onRadarSearch = () => runSearch();
    window.addEventListener("radar-search", onRadarSearch);
```
and in the cleanup: `window.removeEventListener("radar-search", onRadarSearch);`

Then in `MapView.tsx`'s returned JSX, render the pill (near the top overlays, after the opening container div ~`MapView.tsx:282`):

```tsx
      <RadarPill onSearch={() => window.dispatchEvent(new CustomEvent("radar-search"))} />
```

Add `import { RadarPill } from "./RadarPill";`.

- [ ] **Step 6: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Manual, exercise the decision table:
- Search, then change niche → button turns amber "Atualizar busca" + pill "Buscar nesta área · Nicho mudou". Click pill → re-search, button/pill reset.
- Drag radius **down** → NOT dirty (no amber, no pill), markers dim, count drops.
- Drag radius **up** past searched radius → amber + pill "Raio aumentou".
- Pan the map away → pill "Buscar nesta área · Área mudou". Click → re-search centered on new view.
- Presence `all`→`no-website` (when searched as all) → NOT dirty (client subset). `no-website`→`all` → dirty.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/useIsDirty.ts apps/web/src/components/app/RadarPill.tsx apps/web/src/components/app/SearchForm.tsx apps/web/src/components/app/MapView.tsx
git commit -m "feat(radar): dirty-state search button + 'Buscar nesta área' pill with pan-to-search"
```

---

### Task 10: Skeleton lead cards during search

Progress infra already exists (`SearchProgress`); add skeleton cards so the list panel isn't blank while `searching`.

**Files:**
- Modify: the leads list panel (same file located in Task 8).

**Interfaces:**
- Consumes: `useLeadsStore.searching`.

- [ ] **Step 1: Add skeletons**

In the list panel, when `searching` is true and no leads yet, render placeholder cards before the list:

```tsx
{searching && leads.length === 0 && (
  <div className="space-y-2 p-2" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/50" />
    ))}
  </div>
)}
```

Wire `searching` from `useLeadsStore((s) => s.searching)` if not already present.

- [ ] **Step 2: Verify typecheck + manual**

Run: `cd apps/web && bun run typecheck`
Manual: trigger a search from an empty state → skeletons show, then get replaced by results.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/
git commit -m "feat(radar): skeleton lead cards during search"
```

---

## Out of Scope (documented, not built)

- **Streaming markers** as results arrive (`useSearchMutation` real mode imports in one shot at `useSearchMutation.ts:132`). Needs backend paging support — separate spec.
- **Location autocomplete debounce** — suggestions are local/synchronous today (`historyService.suggestLocation`); revisit only if remote geocoding is added.
- **Bidirectional map↔list↔kanban sync** — own spec.

## Verification (whole feature)

Run from `apps/web`:
- `bun test` — geo, searchDraft, search-dirty, filter-counts all pass.
- `bun run typecheck` — clean.
- `bun run lint` — clean.
- Manual walkthrough of the Task 9 Step 6 decision-table checklist.
