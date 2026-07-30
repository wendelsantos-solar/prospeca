# Score Recalibration (Phase 1 of Data-Quality Initiative) — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)
**Parent goal:** Improve lead data quality so hot/warm/cold actually discriminate.
**This spec = Phase 1 only** (score recalibration). Phase 2 (discovery-time
enrichment feeding the score) and Phase 3 (social lookup for no-site businesses)
are separate specs.

## Problem

Under the OSM/Overpass provider (`USE_OSM_PLACES=true`, currently active), the
score has 100 points but only ~55 are reachable, because OSM provides no rating,
no review count, no email/instagram (hardcoded `false`), and no business status:

| Signal | Points | OSM provides? |
|---|---|---|
| Sem site | 25 | yes |
| Telefone válido | 15 | yes |
| WhatsApp possível | 10 | yes (if mobile) |
| Até 10 km | 5 | yes |
| Nota ≥ 4,0 | 10 | **no** |
| 20+ / 100+ avaliações | 15 | **no** |
| E-mail | 10 | **no** (hardcoded false) |
| Instagram | 5 | **no** (hardcoded false) |
| Em operação | 5 | **no** |

45/100 points are structurally unreachable → nothing ever reaches "hot" (≥75) →
temperature can't discriminate. This is a data/calibration problem, not a
threshold bug.

## Goal

Recalibrate the deterministic score to the signals actually available at search
time so the 0–100 scale is usable and "hot" is achievable. Keep it **absolute and
versioned** (comparable across searches, parity-tested). Bump to
`SCORE_RULE_VERSION = "v2.0.0"`.

## Non-Goals

- No new data source (Phase 2/3). Email/Instagram remain absent at search time
  under OSM until Phase 2 enrichment lands — their weights exist in the rule so
  Phase 2 plugs in without another recalibration.
- No percentile/relative scoring (rejected — breaks cross-search comparability
  and the parity model).
- No re-scoring migration of historical `search_results` rows (see Open Items).

## Decisions

| Question | Decision |
|---|---|
| Score model | Absolute, deterministic, versioned (v2.0.0) — recalibrate weights only |
| Com-site businesses | Can still climb via contact/enrich signals (not forced cold) — product may sell SEO/ads/social, not only sites |
| Rating/reviews/operational | Removed from the rule (OSM never provides them; dead weight) |
| Where scoring lives | Collapse the **three** implementations to **two**: the edge mirror (`supabase/functions/_shared/score.ts`, authoritative at runtime) + `packages/domain` (parity mirror). The web app stops shipping its own divergent copy and reuses `@leads/domain`. |

## New Score Rule (v2.0.0)

Search-time signals (OSM-reachable) + enrichment signals (Phase 2 plugs in):

| key | Label | Points | Condition |
|---|---|---|---|
| `no_website` | Sem site | 35 | `!hasWebsite` |
| `valid_phone` | Telefone válido | 20 | `hasValidPhone` |
| `whatsapp` | WhatsApp | 15 | `whatsappStatus` ∈ {possible, verified} |
| `nearby_5` | Até 5 km | 10 | `distanceMeters ≤ 5000` |
| `nearby_15` | Até 15 km | 5 | `5000 < distanceMeters ≤ 15000` (mutually exclusive with `nearby_5`) |
| `category` | Categoria identificada | 5 | `hasCategory` |
| `email` | E-mail comercial | 10 | `hasEmail` (Phase 2) |
| `instagram` | Instagram | 5 | `hasInstagram` (Phase 2) |

- No base points (starts at 0), matching the domain model. The web model's old
  `base: 15` is dropped.
- Clamp to [0, 100].

**Reachability check (search-time, OSM, no enrich):**
- Sem-site, phone, whatsapp, ≤5 km, category = 35+20+15+10+5 = **85 → hot** ✓
- Sem-site, phone, ≤15 km = 35+20+5 = 60 → warm
- Com-site, phone, whatsapp, ≤5 km, category = 20+15+10+5 = 50 → warm
- Com-site + all enrich (Phase 2) = 20+15+10+5+10+5 = 65 → warm (high)
- Sem-site + everything + enrich = **100** (ceiling reachable) ✓

**Thresholds unchanged:** hot ≥ 75, warm ≥ 45, cold < 45. They now sit inside a
reachable range.

## ScoreInput changes

Add one field; grade distance is handled inside `calculateScore` (no input
change beyond `hasCategory`):

```ts
export interface ScoreInput {
  hasWebsite: boolean;
  hasValidPhone: boolean;
  whatsappStatus: "unknown" | "possible" | "verified" | "invalid";
  hasEmail: boolean;
  hasInstagram: boolean;
  hasCategory: boolean;   // NEW
  rating: number | null;        // kept in the type for Phase-2/Google, unused by v2.0.0 rule
  reviewCount: number | null;   // kept, unused by v2.0.0 rule
  distanceMeters: number | null;
  businessStatus: string | null; // kept, unused by v2.0.0 rule
}
```

`scoreInputFromPlace` (both mirrors: `packages/domain/src/score-input.ts` and
`supabase/functions/_shared/score-input.ts`) sets
`hasCategory: (place.primaryType != null || (place.types?.length ?? 0) > 0)`.

Rating/reviewCount/businessStatus stay populated from the place (harmless; the
v2.0.0 rule ignores them, but keeping them means the Google provider path and
Phase 2 don't need another input change).

## Architecture / Files

**Authoritative + parity mirrors (must stay identical, guarded by parity test):**
- `supabase/functions/_shared/score.ts` — v2.0.0 weights (this is what
  `execute-search` runs → stored `score` / `temperature` on `search_results`).
- `supabase/functions/_shared/score-input.ts` — `hasCategory`.
- `packages/domain/src/score.ts` — v2.0.0 weights.
- `packages/domain/src/score-input.ts` — `hasCategory`.

**Web unification (removes the third, divergent copy):**
- `apps/web/package.json` — add `@leads/domain` workspace dependency.
- `apps/web/tsconfig*` / Vite alias — ensure `@leads/domain` resolves (providers
  already imports it, so the monorepo resolution likely exists — verify).
- Delete the bespoke logic in `apps/web/src/lib/score.ts`. Replace with thin
  re-exports/adapters over `@leads/domain`:
  - `calculateScore` and `temperatureFromScore` re-exported from domain.
  - New `scoreInputFromLead(lead: Partial<Lead>): ScoreInput` adapter (maps the
    web `Lead` shape → `ScoreInput`: `hasEmail: !!lead.email`,
    `hasInstagram: !!lead.instagram`, `whatsappStatus: lead.whatsapp ? "verified"
    : "unknown"`, `hasCategory: !!lead.category`, `hasValidPhone: !!lead.phone`,
    `distanceMeters: lead.distanceKm != null ? lead.distanceKm*1000 : null`).
- `apps/web/src/components/app/LeadDetailsDrawer.tsx` — `calculateScore(lead)`
  becomes `calculateScore(scoreInputFromLead(lead))`; the breakdown render maps
  domain items `{key,label,points,reason}` → the existing UI (`label`, `points`,
  and `reason` in place of `explanation`).
- `apps/web/src/mocks/leads.ts` — same adapter call.
- The Phase-1 discovery-preview path (`discoveryToPreviewLead`) already produces a
  `Lead`; its score breakdown now flows through the unified domain rule too.

## Parity / Testing

- Update `packages/domain/src/score-input.test.ts` for the new `hasCategory`
  field and v2.0.0 expected vectors.
- Extend the parity test with a table of canonical `ScoreInput` → expected
  `{total, temperature}` vectors (the reachability rows above) asserted against
  BOTH `packages/domain` and (by import) the `_shared` mirror if importable in the
  test env; otherwise duplicate the vector table in an edge-side test. Goal: any
  future drift between the two mirrors fails a test.
- New `apps/web` test: `scoreInputFromLead` maps a known `Lead` correctly and the
  unified `calculateScore` returns the same total as the domain vector.
- Run: `bun test`, `npm run typecheck`, `npm run lint` (web). See
  [[test-runner-bun]].

## Open Items / Follow-ups

- **Historical rows:** existing `search_results.score/temperature` were computed
  under v1. New searches use v2.0.0 immediately. A backfill (re-score existing
  rows) is optional and deferred — flagged so numbers shifting between old and new
  searches is understood, not surprising. Cheapest path if wanted later: a SQL/
  edge re-score job keyed on `score_breakdown.ruleVersion != 'v2.0.0'`.
- **Google provider:** when `USE_OSM_PLACES=false`, rating/reviews return. v2.0.0
  ignores them, so Google mode would *lose* the rating signal. Before enabling
  Google, decide whether to re-add rating/review weights (provider-aware rule) —
  out of scope here, noted so the OSM-tuned weights aren't assumed universal.
- **Phase 2** plugs `hasEmail`/`hasInstagram`/`whatsappStatus=verified` from
  discovery-time enrichment into this same rule with no further recalibration.

## Files Touched (summary)

- `supabase/functions/_shared/score.ts`, `.../score-input.ts`
- `packages/domain/src/score.ts`, `.../score-input.ts`, `.../score-input.test.ts`
- `apps/web/src/lib/score.ts` (gutted → domain re-export + `scoreInputFromLead`)
- `apps/web/src/components/app/LeadDetailsDrawer.tsx`, `apps/web/src/mocks/leads.ts`
- `apps/web/package.json` (+ `@leads/domain`)
- new web test for `scoreInputFromLead`
