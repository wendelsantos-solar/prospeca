# Score Recalibration (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recalibrate the deterministic lead score to v2.0.0 so it uses signals actually available under OSM, making "hot" reachable and temperature meaningful.

**Architecture:** One scoring rule expressed as two kept-in-sync mirrors: the edge copy (`supabase/functions/_shared/score.ts`, authoritative at runtime) and the workspace copy (`packages/domain`). The web app drops its divergent third copy and reuses `@leads/domain`. Score stays absolute, deterministic, versioned; only weights change plus one new `hasCategory` signal and graded distance.

**Tech Stack:** TypeScript, bun test (see [[test-runner-bun]] — run `bun test`, not vitest), monorepo workspaces (`@leads/domain`), Deno edge functions.

## Global Constraints

- Test runner: `bun test <path>`. `npx vitest` does NOT work here.
- `SCORE_RULE_VERSION = "v2.0.0"` in BOTH mirrors — identical string.
- The edge `_shared` and `packages/domain` score rules MUST stay byte-identical in logic (weights, keys, order, clamp). A parity vector test guards this.
- Thresholds unchanged: hot ≥ 75, warm ≥ 45, cold < 45.
- Weights (v2.0.0), in this order: `no_website` 35, `valid_phone` 20, `whatsapp` 15, `nearby_5` 10 / `nearby_15` 5 (mutually exclusive), `category` 5, `email` 10, `instagram` 5. No base points. Clamp [0,100].
- `rating`, `reviewCount`, `businessStatus` stay in the `ScoreInput` type but are NOT read by the v2.0.0 rule (reserved for the Google provider / Phase 2).
- Canonical score vectors (asserted in every scoring test):
  | # | Input (non-default fields) | total | temp |
  |---|---|---|---|
  | V1 | hasWebsite:false, hasValidPhone:true, whatsappStatus:"possible", hasCategory:true, distanceMeters:3000 | 85 | hot |
  | V2 | hasWebsite:false, hasCategory:true, distanceMeters:12000 | 45 | warm |
  | V3 | hasWebsite:true, hasValidPhone:true, whatsappStatus:"possible", hasCategory:true, distanceMeters:2000 | 50 | warm |
  | V4 | hasWebsite:false, hasValidPhone:true, whatsappStatus:"possible", hasCategory:true, distanceMeters:3000, hasEmail:true, hasInstagram:true | 100 | hot |
  | V5 | hasWebsite:true, distanceMeters:50000 | 0 | cold |
  ("default fields" = hasValidPhone:false, whatsappStatus:"unknown", hasEmail:false, hasInstagram:false, hasCategory:false, rating:null, reviewCount:null, businessStatus:null.)

---

### Task 1: Recalibrate the domain score rule (v2.0.0) + `hasCategory`

**Files:**
- Modify: `packages/domain/src/score.ts`
- Modify: `packages/domain/src/score-input.ts`
- Modify: `packages/domain/src/score-input.test.ts`
- Create: `packages/domain/src/score.test.ts`

**Interfaces:**
- Produces: `calculateScore(input: ScoreInput): ScoreBreakdown` (v2.0.0), `temperatureFromScore(score): "hot"|"warm"|"cold"`, `ScoreInput` (now with `hasCategory: boolean`), `SCORE_RULE_VERSION = "v2.0.0"`, `scoreInputFromPlace(place, distanceMeters)` (now sets `hasCategory`). `PlaceLike` gains `primaryType?`, `types?`.

- [ ] **Step 1: Write the failing vector test**

Create `packages/domain/src/score.test.ts`:

```ts
import { expect, test } from "bun:test";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "./score";
import type { ScoreInput } from "./score";

const base: ScoreInput = {
  hasWebsite: false,
  hasValidPhone: false,
  whatsappStatus: "unknown",
  hasEmail: false,
  hasInstagram: false,
  hasCategory: false,
  rating: null,
  reviewCount: null,
  distanceMeters: null,
  businessStatus: null,
};

const vectors: Array<{ name: string; input: Partial<ScoreInput>; total: number; temp: string }> = [
  {
    name: "V1 sem-site + phone + whatsapp + <=5km + category",
    input: { hasWebsite: false, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 3000 },
    total: 85,
    temp: "hot",
  },
  {
    name: "V2 sem-site + <=15km + category, no phone",
    input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 },
    total: 45,
    temp: "warm",
  },
  {
    name: "V3 com-site + phone + whatsapp + <=5km + category",
    input: { hasWebsite: true, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 2000 },
    total: 50,
    temp: "warm",
  },
  {
    name: "V4 ceiling",
    input: { hasWebsite: false, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 3000, hasEmail: true, hasInstagram: true },
    total: 100,
    temp: "hot",
  },
  {
    name: "V5 com-site only, far",
    input: { hasWebsite: true, distanceMeters: 50000 },
    total: 0,
    temp: "cold",
  },
];

test("rule version is v2.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v2.0.0");
});

for (const v of vectors) {
  test(`score vector: ${v.name}`, () => {
    const { total, ruleVersion } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(ruleVersion).toBe("v2.0.0");
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}

test("nearby_5 and nearby_15 are mutually exclusive", () => {
  const at5 = calculateScore({ ...base, distanceMeters: 5000 });
  expect(at5.items.filter((i) => i.key.startsWith("nearby")).length).toBe(1);
  expect(at5.items.find((i) => i.key === "nearby_5")?.points).toBe(10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/domain && bun test src/score.test.ts`
Expected: FAIL — `SCORE_RULE_VERSION` is still `"v1.0.0"`, totals don't match, `hasCategory` not on type.

- [ ] **Step 3: Add `hasCategory` to `ScoreInput` and rewrite `calculateScore`**

In `packages/domain/src/score.ts`, set the version and add the field:

```ts
export const SCORE_RULE_VERSION = "v2.0.0";

export interface ScoreInput {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  hasInstagram: boolean;
  hasCategory: boolean;
  // Reserved for the Google provider / Phase 2 — NOT read by the v2.0.0 rule.
  rating: number | null;
  reviewCount: number | null;
  distanceMeters: number | null;
  businessStatus: string | null;
}
```

Replace the body of `calculateScore` (keep the `ScoreBreakdown` interface and the `add` helper) with:

```ts
export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const items: ScoreBreakdown["items"] = [];
  const add = (key: string, label: string, points: number, reason: string) =>
    items.push({ key, label, points, reason });

  if (!input.hasWebsite) add("no_website", "Sem site", 35, "Sem presença digital — alta oportunidade");
  if (input.hasValidPhone) add("valid_phone", "Telefone válido", 20, "Contato direto possível");
  if (input.whatsappStatus === "possible" || input.whatsappStatus === "verified")
    add("whatsapp", "WhatsApp", 15, "Canal de contato rápido");
  if (input.distanceMeters != null && input.distanceMeters <= 5000)
    add("nearby_5", "Até 5 km", 10, "Muito próximo");
  else if (input.distanceMeters != null && input.distanceMeters <= 15000)
    add("nearby_15", "Até 15 km", 5, "Próximo");
  if (input.hasCategory) add("category", "Categoria identificada", 5, "Segmento conhecido");
  if (input.hasEmail) add("email", "E-mail comercial", 10, "Canal formal disponível");
  if (input.hasInstagram) add("instagram", "Instagram", 5, "Presença em rede social");

  const total = Math.max(
    0,
    Math.min(
      100,
      items.reduce((s, i) => s + i.points, 0),
    ),
  );
  return { ruleVersion: SCORE_RULE_VERSION, total, items };
}
```

Leave `temperatureFromScore` unchanged.

- [ ] **Step 4: Populate `hasCategory` in `scoreInputFromPlace`**

In `packages/domain/src/score-input.ts`, extend `PlaceLike` and set `hasCategory`:

```ts
export interface PlaceLike {
  websiteUri?: string | null;
  nationalPhoneNumber?: string | null;
  internationalPhoneNumber?: string | null;
  primaryType?: string | null;
  types?: string[] | null;
  rating?: number | null;
  userRatingCount?: number | null;
  businessStatus?: string | null;
}
```

In the returned object add:

```ts
    hasCategory: place.primaryType != null || (place.types?.length ?? 0) > 0,
```

- [ ] **Step 5: Update the existing `score-input.test.ts` for `hasCategory`**

In `packages/domain/src/score-input.test.ts`, first test: pass `primaryType: "restaurant"` in the place object and assert `expect(input.hasCategory).toBe(true);`. Second test: no category fields → assert `expect(input.hasCategory).toBe(false);`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/domain && bun test`
Expected: PASS (all vectors + score-input).

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/score.ts packages/domain/src/score-input.ts packages/domain/src/score.test.ts packages/domain/src/score-input.test.ts
git commit -m "feat(domain): recalibrate lead score to v2.0.0 (OSM-aware, hasCategory)"
```

---

### Task 2: Mirror the rule into the edge `_shared` copy + drift-guard test

**Files:**
- Modify: `supabase/functions/_shared/score.ts`
- Modify: `supabase/functions/_shared/score-input.ts`
- Create: `supabase/functions/_shared/score.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime (edge can't import the workspace pkg); it re-expresses the SAME rule. Consumes the canonical vectors (Global Constraints) as the shared contract.
- Produces: identical `calculateScore` / `SCORE_RULE_VERSION` / `ScoreInput` (with `hasCategory`) for `execute-search` and `import-search-results`.

- [ ] **Step 1: Write the failing vector test**

Create `supabase/functions/_shared/score.test.ts` (imports use the Deno-style `.ts` extension; bun resolves them):

```ts
import { expect, test } from "bun:test";
import { calculateScore, temperatureFromScore, SCORE_RULE_VERSION } from "./score.ts";
import type { ScoreInput } from "./score.ts";

const base: ScoreInput = {
  hasWebsite: false,
  hasValidPhone: false,
  whatsappStatus: "unknown",
  hasEmail: false,
  hasInstagram: false,
  hasCategory: false,
  rating: null,
  reviewCount: null,
  distanceMeters: null,
  businessStatus: null,
};

const vectors: Array<{ name: string; input: Partial<ScoreInput>; total: number; temp: string }> = [
  { name: "V1", input: { hasWebsite: false, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 3000 }, total: 85, temp: "hot" },
  { name: "V2", input: { hasWebsite: false, hasCategory: true, distanceMeters: 12000 }, total: 45, temp: "warm" },
  { name: "V3", input: { hasWebsite: true, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 2000 }, total: 50, temp: "warm" },
  { name: "V4", input: { hasWebsite: false, hasValidPhone: true, whatsappStatus: "possible", hasCategory: true, distanceMeters: 3000, hasEmail: true, hasInstagram: true }, total: 100, temp: "hot" },
  { name: "V5", input: { hasWebsite: true, distanceMeters: 50000 }, total: 0, temp: "cold" },
];

test("edge rule version is v2.0.0", () => {
  expect(SCORE_RULE_VERSION).toBe("v2.0.0");
});

for (const v of vectors) {
  test(`edge score vector: ${v.name}`, () => {
    const { total } = calculateScore({ ...base, ...v.input });
    expect(total).toBe(v.total);
    expect(temperatureFromScore(total)).toBe(v.temp);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test supabase/functions/_shared/score.test.ts`
Expected: FAIL — still v1.0.0 weights.

- [ ] **Step 3: Mirror the v2.0.0 rule**

In `supabase/functions/_shared/score.ts`: set `SCORE_RULE_VERSION = "v2.0.0"`, add `hasCategory: boolean;` to `ScoreInput` (same position as Task 1), and replace the `calculateScore` body with the EXACT block from Task 1 Step 3. Keep the file's leading comment but update it to reference v2.0.0.

- [ ] **Step 4: Mirror `hasCategory` into the edge `scoreInputFromPlace`**

In `supabase/functions/_shared/score-input.ts`, add to the returned object:

```ts
    hasCategory: place.primaryType != null || (place.types?.length ?? 0) > 0,
```

(`GooglePlace` already has `primaryType` and `types`, so no type change is needed there.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test supabase/functions/_shared/score.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify both mirrors agree**

Run: `bun test packages/domain/src/score.test.ts supabase/functions/_shared/score.test.ts`
Expected: PASS for both — same vectors, same results.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/score.ts supabase/functions/_shared/score-input.ts supabase/functions/_shared/score.test.ts
git commit -m "feat(edge): mirror v2.0.0 score rule + drift-guard vector test"
```

---

### Task 3: Unify web scoring onto `@leads/domain`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/score.ts`
- Create: `apps/web/src/lib/score.test.ts`

**Interfaces:**
- Consumes: `calculateScore`, `temperatureFromScore`, `ScoreInput` from `@leads/domain` (Task 1).
- Produces: `scoreInputFromLead(lead: Partial<Lead>): ScoreInput`, plus re-exported `calculateScore` and `temperatureFromScore`. This replaces the old web `calculateScore(lead)` — callers now do `calculateScore(scoreInputFromLead(lead))`.

- [ ] **Step 1: Add the workspace dependency**

In `apps/web/package.json`, under `"dependencies"`, add:

```json
    "@leads/domain": "workspace:*",
```

Then install so the symlink exists:

Run: `bun install` (from repo root)
Expected: `@leads/domain` linked into `apps/web/node_modules`.

- [ ] **Step 2: Write the failing adapter test**

Create `apps/web/src/lib/score.test.ts`:

```ts
import { test, expect } from "bun:test";
import { scoreInputFromLead, calculateScore } from "./score";
import type { Lead } from "@/types";

const lead = {
  category: "Contabilidade",
  hasWebsite: false,
  phone: "+55 21 99999-8888",
  whatsapp: "+55 21 99999-8888",
  email: undefined,
  instagram: undefined,
  distanceKm: 3,
} as Partial<Lead>;

test("scoreInputFromLead maps a lead to ScoreInput", () => {
  const input = scoreInputFromLead(lead);
  expect(input.hasWebsite).toBe(false);
  expect(input.hasValidPhone).toBe(true);
  expect(input.whatsappStatus).toBe("verified");
  expect(input.hasCategory).toBe(true);
  expect(input.hasEmail).toBe(false);
  expect(input.hasInstagram).toBe(false);
  expect(input.distanceMeters).toBe(3000);
});

test("unified calculateScore scores the mapped lead as hot", () => {
  const { total } = calculateScore(scoreInputFromLead(lead));
  // sem-site 35 + phone 20 + whatsapp 15 + <=5km 10 + category 5 = 85
  expect(total).toBe(85);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/score.test.ts`
Expected: FAIL — `scoreInputFromLead` not exported.

- [ ] **Step 4: Replace `apps/web/src/lib/score.ts` with a domain-backed module**

Overwrite the whole file:

```ts
import type { Lead } from "@/types";
import { calculateScore, temperatureFromScore } from "@leads/domain";
import type { ScoreInput } from "@leads/domain";

export { calculateScore, temperatureFromScore };
export type { ScoreInput };

/** Maps a materialized Lead to the domain ScoreInput. A lead that already holds
 * a whatsapp value is treated as verified; distance is km→m. */
export function scoreInputFromLead(lead: Partial<Lead>): ScoreInput {
  return {
    hasWebsite: lead.hasWebsite ?? false,
    hasValidPhone: !!lead.phone,
    whatsappStatus: lead.whatsapp ? "verified" : "unknown",
    hasEmail: !!lead.email,
    hasInstagram: !!lead.instagram,
    hasCategory: !!lead.category,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    distanceMeters: lead.distanceKm != null ? Math.round(lead.distanceKm * 1000) : null,
    businessStatus: null,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/score.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/score.ts apps/web/src/lib/score.test.ts
git commit -m "refactor(web): unify scoring onto @leads/domain (drop divergent copy)"
```

---

### Task 4: Update web consumers of the old `calculateScore(lead)`

**Files:**
- Modify: `apps/web/src/components/app/LeadDetailsDrawer.tsx`
- Modify: `apps/web/src/mocks/leads.ts`

**Interfaces:**
- Consumes: `calculateScore`, `scoreInputFromLead`, `temperatureFromScore` from `@/lib/score` (Task 3). The domain breakdown item shape is `{ key, label, points, reason }` (note: `reason`, not `explanation`).

- [ ] **Step 1: Update the drawer's score call and breakdown render**

In `apps/web/src/components/app/LeadDetailsDrawer.tsx`:

Change the import on line 27 from `import { calculateScore } from "@/lib/score";` to:

```ts
import { calculateScore, scoreInputFromLead } from "@/lib/score";
```

Change the breakdown computation (currently `const breakdown = lead ? calculateScore(lead).breakdown : [];`) to:

```ts
const breakdown = lead ? calculateScore(scoreInputFromLead(lead)).items : [];
```

In the breakdown render (the `breakdown.map((b, i) => ...)` block), change `{b.explanation}` to `{b.reason}` (the domain item field is `reason`). Leave `{b.label}` and `{b.points}` as-is.

- [ ] **Step 2: Update mocks**

In `apps/web/src/mocks/leads.ts`:

Change the import on line 2 to:

```ts
import { calculateScore, temperatureFromScore, scoreInputFromLead } from "@/lib/score";
```

Change lines 187–188 (currently `const { score } = calculateScore(partial);` / `const temperature = temperatureFromScore(score);`) to:

```ts
  const { total: score } = calculateScore(scoreInputFromLead(partial));
  const temperature = temperatureFromScore(score);
```

(The domain return field is `total`; aliasing to `score` keeps the rest of the function unchanged.)

- [ ] **Step 3: Typecheck, lint, and build the web app**

Run: `cd apps/web && npm run typecheck && npm run lint`
Expected: no errors. Fix any `explanation`/`score`→`total`/signature mismatches surfaced.

Run: `cd apps/web && npm run build`
Expected: build succeeds — confirms Vite resolves `@leads/domain` source in the browser bundle.

- [ ] **Step 4: Run the full web + domain test suites**

Run: `bun test` (from repo root, or `cd apps/web && bun test` + `cd packages/domain && bun test`)
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app/LeadDetailsDrawer.tsx apps/web/src/mocks/leads.ts
git commit -m "refactor(web): consume unified domain score in drawer + mocks"
```

---

## Notes for the implementer

- **Do NOT re-score historical rows.** Existing `search_results` keep v1 scores; only new searches get v2.0.0. This is intended (see spec Open Items).
- **Deploy:** the edge `_shared` change only takes effect after the edge functions are redeployed (`supabase functions deploy execute-search` etc.). Local `bun test` proves correctness; deployment is a separate manual step the user runs.
- **Migration rule of thumb** anywhere the old web API lingers: `calculateScore(lead)` → `calculateScore(scoreInputFromLead(lead))`, `.score` → `.total`, `.breakdown` → `.items`, `.explanation` → `.reason`.
