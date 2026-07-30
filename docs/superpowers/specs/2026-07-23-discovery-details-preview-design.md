# Discovery Details Preview — Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)

## Problem

Before the discovery/CRM split (`579d3fe`), the sidebar listed `LeadCard`s that
opened the details modal (`LeadDetailsDrawer`) via `setDetails`. After the split,
discovery results are rendered by `DiscoveryCard` (list) and map popups
(`MapView`), neither of which can open a details view. The only way to inspect a
business's full details today is to add it to the funnel first and open it from
the kanban.

Users want to inspect a discovered business (score composition, contact info,
distance, rating) **before** deciding to prospect it — without materializing a
lead just to peek.

## Goal

Reopen the same `LeadDetailsDrawer` modal from both discovery surfaces
(`DiscoveryCard` and `MapView` popup), with behavior that respects the
discovery/CRM separation:

- Business **already in the funnel** (`importedLeadId != null`) → open the full
  lead drawer (current kanban behavior).
- Business **not in the funnel** → open the same modal in **read-only preview**
  mode. No lead is created. A **+ Funil** button inside the modal converts it and
  transitions to the full drawer.

## Non-Goals

- Enriching discovery data (address / email / instagram / whatsapp are not
  present in `DiscoveryResult`; they render as "—"). On-demand enrichment is a
  separate effort.
- Editing capabilities in preview mode.
- Changing the funnel/CRM data model.

## Decisions

| Question | Decision |
|---|---|
| Not-in-funnel behavior | Read-only preview; no lead created |
| In-funnel behavior | Full `LeadDetailsDrawer` (unchanged) |
| +Funil inside preview | Convert, then **close + toast** (no backend change). Card/popup flip to "No funil"; clicking Detalhes again opens the full drawer. No seamless in-place transition. |
| Trigger surfaces | `DiscoveryCard` button + `MapView` popup button |
| **Oportunidade** tab in preview | **Active** (derived score/insights, needs no lead) |
| Notas / Atividades / Timeline in preview | Empty state: "Adicione ao funil para gerenciar" |
| Informações fields missing from discovery | Render "—" (address, email, instagram, whatsapp); Estágio "— (não no funil)"; Valor estimado / Descoberto em "—" |

## Architecture

### 1. Store (`src/stores/index.ts`)

Add discovery-preview state alongside the existing `detailsId`:

```ts
preview: DiscoveryResult | null;      // set when previewing a non-funnel result
setPreview: (r: DiscoveryResult | null) => void;
```

`detailsId` (lead-id driven) stays as-is. The two are mutually exclusive at the
UI level — opening one clears the other.

### 2. Trigger helper

A small `openDiscoveryDetails(result)` used by both surfaces:

```ts
if (result.importedLeadId != null) setDetails(result.importedLeadId);
else setPreview(result);
```

- **`DiscoveryCard`** (`src/components/app/DiscoveryCard.tsx`): add a "Detalhes"
  button (ghost, small) in the action row next to WhatsApp/Funil. `stopPropagation`
  like the existing buttons so it doesn't also trigger the card's `setFocused`.
- **`MapView`** (`src/components/app/MapView.tsx`): add a `data-action="details"`
  button to `popupHtml`. Extend the existing delegated click handler
  (`MapView:259`) with an `action === "details"` branch that calls the same
  helper. No new listener needed.

### 3. `LeadDetailsDrawer` (`src/components/app/LeadDetailsDrawer.tsx`)

- `open = !!detailsId || !!preview`.
- Source resolution:
  - `detailsId` present → `useLeadDetail(detailsId)` (funnel lead), full mode.
  - else `preview` present → adapt `DiscoveryResult` → a lead-shaped, read-only
    object via `discoveryToPreviewLead(result)`.
- `readOnly = !detailsId && !!preview`.
- `onOpenChange` close → clear **both** `detailsId` and `preview`.

**Header (readOnly):** show a **+ Funil** button. Uses the existing
`useAddToFunnelMutation` (stage `"new"`). On success: `setPreview(null)` (closes
the modal) and toast "Adicionado ao funil". The discovery query is invalidated by
the mutation, so the card/popup re-render with the "No funil" badge; clicking
Detalhes again resolves `importedLeadId` and opens the full lead drawer. No
in-place preview→full transition — this avoids a backend change, since
`addToFunnel` only returns enrichable (with-website) lead ids, not the created id
for every add.

**Tabs (readOnly):**
- **Informações** — rendered. Real: category, phone, website/hasWebsite,
  distance, rating, reviewCount, score/temperature. Missing-in-discovery →
  "—": address, email, instagram, whatsapp. Estágio → "— (não no funil)".
  Valor estimado / Descoberto em → "—".
- **Oportunidade** — rendered (score breakdown + insights). Derived from
  `calculateScore(lead)`; the adapter provides the fields it needs (hasWebsite,
  rating, reviewCount, distanceKm), so it works without a lead.
- **Notas / Atividades / Timeline** — replaced by an empty-state block:
  "Adicione ao funil para gerenciar notas, atividades e timeline." No inputs
  rendered. Tab triggers stay visible (counts show 0) for layout parity.

### 4. Adapter `discoveryToPreviewLead(r: DiscoveryResult): Lead`

Maps discovery fields to the `Lead` shape and fills placeholders so the existing
render paths (and `calculateScore`) don't crash:

| Lead field | Source |
|---|---|
| `id` | `r.placeId` (preview only — never persisted) |
| `companyName` | `r.name` |
| `category` | `r.category ?? ""` |
| `latitude` / `longitude` | `r.latitude` / `r.longitude` |
| `distanceKm` | `r.distanceKm` |
| `phone` | `r.phone ?? undefined` |
| `website` / `hasWebsite` | `r.website ?? undefined` / `r.hasWebsite` |
| `rating` / `reviewCount` | `r.rating ?? undefined` / `r.reviewCount ?? undefined` |
| `score` / `temperature` | `r.score` / `r.temperature` |
| `address` | `""` |
| `neighborhood` / `city` / `state` | `undefined` / `""` / `""` |
| `whatsapp` / `email` / `instagram` | `undefined` |
| `stage` | `undefined`-equivalent — see note |
| `estimatedValue` / `discoveredAt` | `undefined` / `""` |
| `notes` / `activities` / `timeline` | `[]` / `[]` / `[]` |

Note: `Lead.stage` is a required `LeadStage`. The adapter keeps preview render
paths from reading `STAGE_LABELS[lead.stage]` directly — Informações in readOnly
shows a literal "— (não no funil)" instead of `STAGE_LABELS[stage]`. The adapter
may set a sentinel stage value that the readOnly branch never uses for labeling.

## Data Flow

```
DiscoveryCard "Detalhes" ─┐
                          ├─ openDiscoveryDetails(result)
MapView popup "Detalhes" ─┘        │
                                   ├─ inFunnel → setDetails(leadId) ─→ full drawer
                                   └─ else     → setPreview(result) ─→ readOnly preview
                                                                          │
                                              +Funil (addToFunnel 'new') ─┘
                                                → setPreview(null) + toast; modal closes
                                                → discovery invalidated → card/popup "No funil"
                                                → Detalhes again → setDetails(importedLeadId) → full
```

## Error Handling

- `openWhats` in preview: same guard as today (no phone → toast error).
- +Funil success: `setPreview(null)` + toast; on failure the preview stays open
  and the existing mutation error toast fires.
- Adapter never persists; closing the modal simply clears store state.

## Testing

- **Adapter unit test** (`discoveryToPreviewLead`): known `DiscoveryResult` →
  correct field mapping, empty collections, missing fields undefined.
- **DiscoveryCard**: "Detalhes" button calls `setPreview` when not in funnel;
  calls `setDetails(importedLeadId)` when in funnel; `stopPropagation` verified.
- **MapView**: `data-action="details"` branch routes to the same helper.
- **Drawer readOnly**: given a `preview`, Informações renders "—" for missing
  fields, Oportunidade renders score breakdown, Notas/Atividades/Timeline render
  the empty state (no inputs). +Funil calls `addToFunnel('new')` then
  `setPreview(null)` (modal closes) with a success toast.
- **Regression**: in-funnel result opens the full drawer unchanged.

## Files Touched

- `src/stores/index.ts` — `preview` state + `setPreview`.
- `src/lib/discovery-preview.ts` (new) — `discoveryToPreviewLead` adapter.
- `src/components/app/DiscoveryCard.tsx` — "Detalhes" button + helper.
- `src/components/app/MapView.tsx` — popup button + `details` action branch.
- `src/components/app/LeadDetailsDrawer.tsx` — preview source, `readOnly` mode,
  +Funil transition, empty states.
- Tests alongside the above.
