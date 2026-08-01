# Landing + Pricing Copy Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the one false-advertising risk on the public marketing site (AgencySection selling team features the pilot doesn't offer) and a related bug in UseCasesSection, sharpen weak copy where it fails the voice principles below, and fix a pricing-flow inconsistency found during review — all while leaving already-compliant copy untouched.

**Architecture:** Content-only changes to React components under `apps/web/src/components/marketing/`. No new components, no route changes, no database/schema changes. One behavioral fix (Task 4) makes a landing-page pricing card use the same assisted-activation flow (`SalesContactForm`) that the real `/precos` page already uses, instead of bypassing it.

**Tech Stack:** React 19, TypeScript, TanStack Router (`Link`), Tailwind, `lucide-react` icons, `react-hook-form` + `zod` (existing `SalesContactForm`, unchanged).

## Global Constraints

- Voice principles (from `docs/superpowers/specs/2026-08-01-landing-pricing-copy-rewrite-design.md`): concrete pain before benefit; mechanism over adjective (cite score transparency, real data, user's-own-WhatsApp send — never generic superlatives like "poderoso"/"completo"); one dominant CTA per section, never two competing; never state a feature as available unless it has real backing — anything without backing becomes "em breve" or is cut.
- No fabricated testimonials, case-study numbers, or countdown timers. Do not touch `TestimonialsSection.tsx`, `CaseStudySection.tsx`, or `FounderOffer.tsx` — they already comply, and editing risks weakening their anti-fabrication guardrail comments.
- No pricing/plan/limit changes in the database — copy must only ever restate what `apps/web/src/lib/billing-plans.ts` (`fetchBillingPlans()`, `PUBLIC_PILOT_PLANS = ["free", "professional"]`) actually returns.
- No route or page-structure changes, no new components.
- Verify with `bun run typecheck` and `bun test` (run from `apps/web/`) after every task, plus a final manual browser smoke check (Task 5).

## Coverage Note (why only 4 files change)

Every one of the 18 landing sections plus the 4 pricing components was reviewed against the voice principles above during planning. Most already comply — `ProblemSection`, `HowItWorksSection`, `OpportunitySection`, `ScoreSection`, `MapSection`, `PipelineSection`, `MessagingSection`, `BenefitsSection`, `FinalCTA`, `MarketingHeader`, `FAQSection`, and `PricingPage`/`PricingComparison`/`PlanCard` already lead with concrete mechanism proof, use one CTA per section, and (per the earlier audit) never claim a feature without real backing. Rewriting them would be churn with no reader-facing improvement — skipped per YAGNI.

Four files need real changes:
1. **`HeroSection.tsx` + `TrustStrip.tsx`** — sub-copy and step descriptions lean on soft language ("ajuda você", "veja... e por quê") instead of naming the mechanism (score, pipeline). Light tighten.
2. **`UseCasesSection.tsx`** — the "Agências" use-case card promises team distribution/tracking that isn't sold (same defect class as AgencySection below, found during this review).
3. **`AgencySection.tsx`** — the compliance fix: currently sells "Múltiplos usuários / Permissões por papel / Buscas salvas compartilhadas / Relatórios por usuário" for a plan (`agency`) that `billing-plans.ts` never returns to the public, contradicts `FAQSection.tsx`'s own disclaimer on the same page, and its CTA links to a dead in-page anchor (`/precos#agencia` — `PlanCard` only sets that `id` for `plan.code === "agency"`, which never renders). Full reframe to an honest waitlist.
4. **`PricingTeaser.tsx`** — found during review: its mini pricing cards send the `professional` plan straight to `/cadastro?plan=professional`, bypassing the assisted-activation `SalesContactForm` flow that `PlanCard.tsx` (used on the real `/precos` page) already enforces for non-free plans. Also has copy inconsistent with `PlanCard`/`PricingComparison` ("Suporte prioritário" vs. "Onboarding assistido") and a description implying self-serve upgrade ("Faça upgrade quando fizer sentido").

---

### Task 1: Hero + TrustStrip copy tighten

**Files:**
- Modify: `apps/web/src/components/marketing/HeroSection.tsx:17-20`
- Modify: `apps/web/src/components/marketing/TrustStrip.tsx:3-25`

**Interfaces:**
- Consumes: nothing new — pure JSX text/string literal edits, no prop or signature changes.
- Produces: nothing new — no other file imports these strings.

- [ ] **Step 1: Rewrite the Hero subhead**

In `apps/web/src/components/marketing/HeroSection.tsx`, replace lines 17-20:

```tsx
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Pesquise empresas por nicho e região, identifique oportunidades com baixa presença
            digital e organize toda a sua prospecção em um só lugar.
          </p>
```

with:

```tsx
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Pesquise por nicho e região, veja o score que explica quem priorizar primeiro e
            organize toda a prospecção — da descoberta ao fechamento — em um só lugar.
          </p>
```

- [ ] **Step 2: Rewrite the TrustStrip step descriptions**

In `apps/web/src/components/marketing/TrustStrip.tsx`, replace lines 3-25:

```tsx
const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise empresas por nicho, cidade e raio." },
  {
    icon: Target,
    label: "Priorize",
    description: "Veja quais negócios têm mais potencial e por quê.",
  },
  {
    icon: MessageCircle,
    label: "Aborde",
    description: "Prepare mensagens com dados reais do lead.",
  },
  {
    icon: CalendarDays,
    label: "Acompanhe",
    description: "Organize retornos e atividades sem perder o fio.",
  },
  {
    icon: BadgeCheck,
    label: "Converta",
    description: "Feche negócio com contexto do início ao fim.",
  },
];
```

with:

```tsx
const STEPS = [
  { icon: Search, label: "Encontre", description: "Pesquise por nicho, cidade e raio de busca." },
  {
    icon: Target,
    label: "Priorize",
    description: "O score explica quem vale seu tempo primeiro — sem caixa-preta.",
  },
  {
    icon: MessageCircle,
    label: "Aborde",
    description: "Mensagem pronta com os dados reais do lead.",
  },
  {
    icon: CalendarDays,
    label: "Acompanhe",
    description: "Pipeline com próxima ação e lembrete, sem perder o fio.",
  },
  {
    icon: BadgeCheck,
    label: "Converta",
    description: "Do primeiro contato ao fechamento, com contexto completo.",
  },
];
```

- [ ] **Step 3: Verify**

Run: `cd apps/web && bun run typecheck && bun test`
Expected: both pass with no errors (no logic changed, only string literals).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/HeroSection.tsx apps/web/src/components/marketing/TrustStrip.tsx
git commit -m "copy: sharpen hero and trust-strip copy with mechanism proof"
```

---

### Task 2: Fix UseCasesSection "Agências" overselling

**Files:**
- Modify: `apps/web/src/components/marketing/UseCasesSection.tsx:30-34`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Replace the Agências case description**

In `apps/web/src/components/marketing/UseCasesSection.tsx`, replace lines 30-34:

```tsx
  {
    icon: Building2,
    title: "Agências",
    description: "Distribua oportunidades, acompanhe a equipe e organize múltiplas campanhas.",
  },
```

with:

```tsx
  {
    icon: Building2,
    title: "Agências",
    description: "Centralize a prospecção da agência em um pipeline único, do contato ao fechamento.",
  },
```

This removes the "distribute across team / track the team" claim — that's the same unavailable-team-feature promise found in `AgencySection.tsx` (Task 3), just in a different section. The rewritten line only claims what a single agency-owner account can already do today.

- [ ] **Step 2: Verify**

Run: `cd apps/web && bun run typecheck && bun test`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/marketing/UseCasesSection.tsx
git commit -m "fix: remove unavailable team-feature claim from UseCasesSection"
```

---

### Task 3: Reframe AgencySection as an honest waitlist (compliance fix)

**Files:**
- Modify: `apps/web/src/components/marketing/AgencySection.tsx` (full rewrite of the file body)

**Interfaces:**
- Consumes: `SalesContactForm` from `./SalesContactForm` — exact existing signature: `SalesContactForm({ trigger, source }: { trigger: ReactNode; source: string })`. Renders a dialog with a lead-capture form that POSTs to the `submit-sales-contact` edge function on submit; do not modify `SalesContactForm.tsx` itself.
- Consumes: `track` from `@/lib/analytics` — existing `track(eventName: string, props: object)` used elsewhere in this codebase (e.g. `HeroSection.tsx:26`).
- Produces: nothing new — no other file imports anything from `AgencySection.tsx` beyond the `AgencySection` component itself (already wired into `LandingPage.tsx:60`, unchanged).

- [ ] **Step 1: Replace the full file contents**

Replace the entire contents of `apps/web/src/components/marketing/AgencySection.tsx` with:

```tsx
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingSection, MarketingContainer, SectionHeading } from "./MarketingLayout";
import { SalesContactForm } from "./SalesContactForm";
import { track } from "@/lib/analytics";

export function AgencySection() {
  return (
    <MarketingSection id="agencias" muted spacing="lg">
      <MarketingContainer width="default">
        <SectionHeading
          eyebrow="Para equipes"
          title="Trabalha em equipe? O multiusuário está a caminho."
          description="Hoje o piloto é individual por organização. Múltiplos usuários, permissões por papel e relatórios por usuário estão no roadmap — entre na lista e avisamos assim que abrir."
          center
        />
        <div className="mt-8 flex justify-center">
          <SalesContactForm
            source="agency_waitlist"
            trigger={
              <Button
                onClick={() => track("agency_waitlist_clicked", { location: "agency_section" })}
              >
                <Users className="mr-1.5 h-4 w-4" />
                Entrar na lista de espera
              </Button>
            }
          />
        </div>
      </MarketingContainer>
    </MarketingSection>
  );
}
```

This drops the `RESOURCES`/`FEATURES` grids that claimed multi-user/roles/shared-searches/reports as available today, drops the dead `Link to="/precos" hash="agencia"` CTA, and replaces it with a `SalesContactForm` trigger (same lead-capture mechanism the pricing page already uses for paid plans) tagged `source="agency_waitlist"` so these leads are distinguishable in `submit-sales-contact` records from pricing-page contacts.

- [ ] **Step 2: Confirm no other file references the removed exports**

Run: `grep -rn "RESOURCES\|FEATURES" apps/web/src/components/marketing/AgencySection.tsx`
Expected: no matches (both arrays were local to this file, not exported — confirms nothing else could have imported them).

- [ ] **Step 3: Verify**

Run: `cd apps/web && bun run typecheck && bun test`
Expected: both pass. `typecheck` in particular confirms `SectionHeading`'s `description` prop accepts a string (already used this way in `HowItWorksSection.tsx:40`) and that removed imports (`Link`, `Check`, `ArrowRight`, `Shield`, `BarChart3`, `Save`) don't leave unused-import lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/AgencySection.tsx
git commit -m "fix: reframe AgencySection as honest waitlist instead of selling unavailable team features"
```

---

### Task 4: Fix PricingTeaser's non-free CTA and align copy

**Files:**
- Modify: `apps/web/src/components/marketing/PricingTeaser.tsx`

**Interfaces:**
- Consumes: `SalesContactForm` from `./SalesContactForm` — same signature as Task 3: `{ trigger: ReactNode; source: string }`.
- Consumes: `BillingPlan`, `formatPriceCents`, `fetchBillingPlans` from `@/lib/billing-plans` — unchanged, already imported in this file.
- Produces: nothing new.

- [ ] **Step 1: Add the `SalesContactForm` import**

In `apps/web/src/components/marketing/PricingTeaser.tsx`, after line 6 (`import { track } from "@/lib/analytics";`), add:

```tsx
import { SalesContactForm } from "./SalesContactForm";
```

- [ ] **Step 2: Align the `professional` feature label**

Replace lines 18-24:

```tsx
  professional: [
    "30 buscas por mês",
    "200 leads processados",
    "Pipeline completo",
    "Exportação CSV",
    "Suporte prioritário",
  ],
```

with:

```tsx
  professional: [
    "30 buscas por mês",
    "200 leads processados",
    "Pipeline completo",
    "Exportação CSV",
    "Onboarding assistido",
  ],
```

This matches the terminology `PlanCard.tsx`/`PricingComparison.tsx` already use (`SUPPORT_LABEL.professional = "Onboarding assistido"`) — same plan, same wording everywhere it's mentioned.

- [ ] **Step 3: Fix the non-free CTA to use the assisted-activation flow**

Replace the CTA block inside `PricingCard` (current lines 69-80):

```tsx
      <div className="mt-6">
        <Button
          className="w-full"
          variant={highlighted ? "default" : "outline"}
          asChild
          onClick={() => track("plan_selected", { plan: plan.code })}
        >
          <Link to="/cadastro" search={{ plan: plan.code }}>
            {isFree ? "Começar grátis" : "Testar grátis"}
          </Link>
        </Button>
      </div>
```

with:

```tsx
      <div className="mt-6">
        {isFree ? (
          <Button
            className="w-full"
            variant={highlighted ? "default" : "outline"}
            asChild
            onClick={() => track("plan_selected", { plan: plan.code })}
          >
            <Link to="/cadastro" search={{ plan: plan.code }}>
              Começar grátis
            </Link>
          </Button>
        ) : (
          <SalesContactForm
            source={`landing_pricing_${plan.code}`}
            trigger={
              <Button
                className="w-full"
                variant={highlighted ? "default" : "outline"}
                onClick={() => track("plan_selected", { plan: plan.code })}
              >
                Solicitar acesso ao piloto
              </Button>
            }
          />
        )}
      </div>
```

Before this fix, clicking "Testar grátis" on the `professional` card here sent the visitor straight to `/cadastro?plan=professional` — a self-serve signup path — while the identical card on `/precos` (`PlanCard.tsx:82-94`) opens `SalesContactForm` instead, because the paid plan requires manual/assisted activation (no Stripe integration exists yet). This made the landing-page teaser promise a self-serve flow the product doesn't have. Both entry points now behave the same way.

- [ ] **Step 4: Tighten the section description**

Replace line 95 (`description="Comece de graça. Faça upgrade quando fizer sentido."`) with:

```tsx
          description="Comece de graça. Peça acesso ao piloto pago quando fizer sentido."
```

- [ ] **Step 5: Verify**

Run: `cd apps/web && bun run typecheck && bun test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/marketing/PricingTeaser.tsx
git commit -m "fix: route PricingTeaser's paid-plan CTA through the assisted-activation flow"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full typecheck and test suite**

Run: `cd apps/web && bun run typecheck && bun test && bun run lint`
Expected: all pass, zero errors, zero new lint warnings.

- [ ] **Step 2: Start the dev server**

Run: `cd apps/web && bun run dev` (background)
Expected: server starts clean on its usual port with no runtime errors in the terminal.

- [ ] **Step 3: Browser smoke check**

Load the landing page (`/`) and visually confirm, in order:
- Hero subhead reads the new "score que explica quem priorizar primeiro" copy.
- TrustStrip shows the five updated step descriptions.
- UseCases "Agências" card no longer mentions distributing/tracking a team.
- The Agências/"Para equipes" section shows the waitlist headline and "Entrar na lista de espera" button (no more feature grid, no more link to `/precos#agencia`); clicking the button opens the `SalesContactForm` dialog.
- Scroll to the pricing teaser section: the `professional` card's button reads "Solicitar acesso ao piloto" and opens the same `SalesContactForm` dialog (not a direct navigation to `/cadastro`).

Then load `/precos` and confirm the real pricing page still renders `free`/`professional` cards correctly and the comparison table is unaffected (Task 4 didn't touch `PlanCard.tsx` or `PricingComparison.tsx`, but confirm nothing regressed).

- [ ] **Step 4: Stop the dev server**

Kill the background dev server process once the check is done.

No commit for this task — it's verification only; Tasks 1-4 are already committed individually.
