# Landing + Pricing Copy Rewrite — Design

**Date:** 2026-08-01
**Status:** Approved (pending spec review)

## Problem

Two issues found in an audit of the public marketing site (`apps/web/src/components/marketing/*`, `PricingPage`, `PricingComparison`, `PlanCard`, `FAQSection`) ahead of paid-launch traffic:

1. **Copy is not optimized for trial-signup conversion or retention.** Sections lean on adjectives ("poderoso", "completo") instead of concrete mechanism proof, and CTAs are inconsistent across sections.
2. **False-advertising risk (CDC Art. 37 — propaganda enganosa):** `AgencySection.tsx` sells "Múltiplos usuários", "Permissões por papel", "Buscas salvas compartilhadas", "Relatórios por usuário" as available features. These belong to an `agency` billing plan that is excluded from `PUBLIC_PILOT_PLANS` (`billing-plans.ts:25`) — the plan is never fetched, never rendered on `/precos`. `FAQSection.tsx:50` directly contradicts the Agency section on the same page: "O piloto atual é individual por organização. A experiência completa de equipes ainda está no roadmap e não é vendida como disponível." The Agency section's CTA (`Link to="/precos" hash="agencia"`) also points at a DOM anchor (`id="agencia"`) that `PlanCard` only sets for `plan.code === "agency"` — since that plan never renders, the anchor is dead.

## Goal

Rewrite landing + pricing copy end-to-end to drive trial signups ("Começar grátis"), while fixing the Agency section so the page stops promising team features the product doesn't sell yet. Audience is a mix of solo freelancers and small agencies with no reliable way to segment traffic yet, so copy must work for both without a UI branch.

## Non-Goals

- No solo/agency toggle or any new stateful component (that's a future "Approach B" if traffic segmentation data ever justifies it).
- No fabricated testimonials, case-study numbers, or countdown timers — `TestimonialsSection`/`CaseStudySection`/`FounderOffer` already block this by code comment/flag; this pass does not touch that policy.
- No pricing/plan/limit changes in the database — copy only reflects what `billing-plans.ts` / `PricingComparison` already expose.
- No route or page-structure changes — same 18 sections, same order, same files.
- No payment/checkout work — pricing copy continues to frame the paid plan as "ativação assistida" via `SalesContactForm`, consistent with current (accurate) messaging.

## Decisions

| Question | Decision |
|---|---|
| Scope of rewrite | All copy strings (headline/subhead/body/CTA labels) in the 18 landing sections + `PricingPage`, `PricingComparison`, `PlanCard`, `FAQSection`. No JSX structure/logic changes except the Agency section. |
| Agency section fix | Replace `RESOURCES`/`FEATURES` (unavailable team features) with an honest waitlist framing: headline like "Trabalha em equipe? Em breve." + a lead-capture CTA (reuse `SalesContactForm` or link to the FAQ's team-status answer). Remove the dead `hash="agencia"` link entirely — CTA no longer points at a plan card. |
| Copy voice rules | (1) Lead with concrete pain, benefit second. (2) Mechanism over adjective — cite score transparency, real Google Places data, user's-own-WhatsApp send, in place of generic superlatives. (3) One dominant CTA per key section: "Começar grátis", never two competing CTAs in the same section. (4) Never state a feature as available unless it has real backing per the existing audit — anything without backing becomes "em breve" or is cut. |
| Pricing-page accuracy pass | `PricingComparison` rows must continue to match the actual `limits`/`features` shape returned by `fetchBillingPlans()` — copy pass includes a diff check against `billing-plans.ts`, not just wording. |
| Testing/verification | `bun run typecheck`, `bun test`, then manual visual check via dev server + browser across Hero → Pricing → Agency-section-fix before calling it done. No new automated tests needed — this is a content change with no new logic, except the Agency section swap, which should get a quick smoke check that the dead-anchor CTA is gone. |

## Risks / Edge Cases

- Rewriting copy across 18 files in one pass risks losing the existing anti-fabrication guardrails (code comments blocking testimonials/case-study numbers). The plan must explicitly preserve those comments and flags (`CASE_STUDY_ENABLED = false`, testimonial no-fabrication comment, `FounderOffer` DB-driven gating) — copy rewrite touches surrounding text only, not those flags.
- `FAQSection.tsx:50`'s team disclaimer must stay (or be strengthened) even after the Agency section is rewritten, since it's the one place that's already accurate — don't let the rewrite accidentally soften or remove it.
- Waitlist CTA on the Agency section needs a real destination (existing `submit-sales-contact` edge function via `SalesContactForm`, or a mailto/anchor to FAQ) — must not introduce a new dead link while fixing the old one.
