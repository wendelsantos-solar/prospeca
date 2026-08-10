# Hero & Prova Social — Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the landing page hero with real social proof (Google/Trustpilot ratings), an illustrative activity card, and orbiting icons — all traceable to something the product actually does today.

**Architecture:** Pure presentational change inside `apps/web/src/components/marketing/`. One new data file (`social-proof-data.ts`) holds the only numbers that can go stale, isolated for easy auditing. One new shared icon file avoids duplicating the Google "G" logo that already exists in `GoogleAuthButton.tsx`. `HeroSection.tsx` and `HeroProductDemo.tsx` get targeted edits, no new routes or state.

**Tech Stack:** React + TypeScript, Tailwind (existing design tokens), lucide-react icons. No new dependencies.

## Global Constraints

- No number, logo, or claimed capability may appear that isn't real and verifiable today. Source: `docs/superpowers/specs/2026-08-07-hero-social-proof-redesign-design.md`.
- Ratings: Google 4.7, Trustpilot 4.8 with 185 reviews — hardcode exactly these values, comment the source, do not invent additional metrics (e.g. no "+300 clientes" unless later confirmed).
- Google Calendar integration does NOT appear anywhere in this work. It ships in a future feature; adding it now is out of scope by explicit product decision.
- Icons represent only mechanisms confirmed in code: WhatsApp deep link (`apps/web/src/lib/outbound.ts`, `wa.me`), Google login (`apps/web/src/hooks/useAuth.ts`, OAuth via Supabase). The "maps" slot uses a generic `MapPin` icon (not a reproduction of Google's Maps logo) to represent the location/search capability without a trademark claim.
- This codebase has no unit tests for marketing/presentational components (`HeroProductDemo.tsx`, `TrustStrip.tsx`, etc. have none). Follow that convention: verification here is `bun run typecheck`, `bun run lint`, `bun run build`, plus a manual browser check — not new unit test files.
- Runtime: `bun`, not `npm`/`pnpm`/`yarn`. Use `bun run <script>`.

---

### Task 1: Shared brand icons file

**Files:**
- Create: `apps/web/src/components/marketing/brand-icons.tsx`
- Modify: `apps/web/src/components/auth/GoogleAuthButton.tsx:76-102` (remove local `GoogleIcon`, import shared one)
- Modify: `apps/web/src/components/marketing/MessagingSection.tsx:34-45` (remove inline WhatsApp svg, import shared one)

**Interfaces:**
- Produces: `GoogleIcon({ className }: { className?: string }): JSX.Element` and `WhatsAppIcon({ className }: { className?: string }): JSX.Element`, both exported from `brand-icons.tsx`. Later tasks import these two names from this file.

- [ ] **Step 1: Create the shared icons file**

```tsx
// apps/web/src/components/marketing/brand-icons.tsx

/**
 * Brand icons reused across marketing and auth surfaces.
 * Kept in one place so the same glyph never drifts between call sites.
 */

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
```

- [ ] **Step 2: Wire `GoogleAuthButton.tsx` to the shared icon**

In `apps/web/src/components/auth/GoogleAuthButton.tsx`:
- Add import: `import { GoogleIcon } from "@/components/marketing/brand-icons";`
- Delete the local `function GoogleIcon(...)` block (lines 76-102 in current file).
- Leave every usage of `<GoogleIcon className="h-[18px] w-[18px]" />` as-is — same name, same props, now imported.

- [ ] **Step 3: Wire `MessagingSection.tsx` to the shared icon**

In `apps/web/src/components/marketing/MessagingSection.tsx`:
- Add import: `import { WhatsAppIcon } from "./brand-icons";`
- Replace the inline `<svg className="h-3.5 w-3.5" ...>...</svg>` block (lines 36-44) with `<WhatsAppIcon className="h-3.5 w-3.5" />`.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors. If `GoogleIcon` or the removed inline svg leaves an unused import/variable, fix it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/marketing/brand-icons.tsx apps/web/src/components/auth/GoogleAuthButton.tsx apps/web/src/components/marketing/MessagingSection.tsx
git commit -m "refactor: extract shared Google and WhatsApp icons into brand-icons.tsx"
```

---

### Task 2: Social proof data + badges component

**Files:**
- Create: `apps/web/src/marketing/social-proof-data.ts`
- Create: `apps/web/src/components/marketing/SocialProofBadges.tsx`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `SOCIAL_PROOF` const (typed `{ google: { rating: number }, trustpilot: { rating: number; reviewCount: number } }`) from `social-proof-data.ts`; `SocialProofBadges(): JSX.Element` component from `SocialProofBadges.tsx`. Task 3 imports `SocialProofBadges` and renders it.

- [ ] **Step 1: Create the data file**

```ts
// apps/web/src/marketing/social-proof-data.ts

/**
 * Real ratings from the Prospeca Google Business Profile and Trustpilot page.
 * Update manually when the numbers change — never estimate or round up.
 * Last confirmed: 2026-08-07.
 */
export const SOCIAL_PROOF = {
  google: { rating: 4.7 },
  trustpilot: { rating: 4.8, reviewCount: 185 },
};
```

- [ ] **Step 2: Create the badges component**

```tsx
// apps/web/src/components/marketing/SocialProofBadges.tsx
import { Star } from "lucide-react";
import { SOCIAL_PROOF } from "@/marketing/social-proof-data";

export function SocialProofBadges() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-caption text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.google.rating}</span>
        Google
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-warning text-warning" />
        <span className="font-semibold text-foreground">{SOCIAL_PROOF.trustpilot.rating}</span>
        Trustpilot · {SOCIAL_PROOF.trustpilot.reviewCount} avaliações
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors (component not yet used anywhere — that's fine, next task wires it in).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/marketing/social-proof-data.ts apps/web/src/components/marketing/SocialProofBadges.tsx
git commit -m "feat: add social proof data and badges component"
```

---

### Task 3: Wire headline + social proof badges into HeroSection

**Files:**
- Modify: `apps/web/src/components/marketing/HeroSection.tsx`

**Interfaces:**
- Consumes: `SocialProofBadges` from `./SocialProofBadges` (Task 2).
- Produces: nothing new for later tasks — this is the final text/copy state of the hero's top block.

- [ ] **Step 1: Add the import**

In `apps/web/src/components/marketing/HeroSection.tsx`, add:
```tsx
import { SocialProofBadges } from "./SocialProofBadges";
```

- [ ] **Step 2: Render badges above the eyebrow, and swap the headline**

Replace:
```tsx
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Inteligência comercial local</Eyebrow>
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-tight text-foreground md:text-[3rem] lg:text-[3.5rem]">
            Encontre empresas que precisam do serviço que você vende.
          </h1>
```
With:
```tsx
        <div className="mx-auto max-w-3xl text-center">
          <SocialProofBadges />
          <Eyebrow>Inteligência comercial local</Eyebrow>
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-tight text-foreground md:text-[3rem] lg:text-[3.5rem]">
            Pare de adivinhar quem prospectar. Veja o score antes de ligar.
          </h1>
```

Leave the subhead paragraph, CTAs, and "sem cartão de crédito" line unchanged.

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/HeroSection.tsx
git commit -m "feat: add social proof badges and sharpen hero headline"
```

---

### Task 4: Floating icons around the hero product demo

**Files:**
- Create: `apps/web/src/components/marketing/FloatingIcons.tsx`
- Modify: `apps/web/src/components/marketing/HeroSection.tsx`

**Interfaces:**
- Consumes: `GoogleIcon`, `WhatsAppIcon` from `./brand-icons` (Task 1).
- Produces: `FloatingIcons(): JSX.Element`, absolutely positioned, `pointer-events-none`, meant to be rendered as a sibling of `HeroProductDemo` inside a `relative` wrapper.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/marketing/FloatingIcons.tsx
import { Target, GitBranch, MessageCircle, MapPin, type LucideIcon } from "lucide-react";
import { GoogleIcon, WhatsAppIcon } from "./brand-icons";

interface FloatingIconSpec {
  Icon: LucideIcon | typeof GoogleIcon;
  top: string;
  left: string;
  delay: string;
  bg: string;
  iconClass: string;
}

/**
 * Icons orbiting the hero product demo. Only WhatsApp and Google represent
 * real integrations (wa.me deep link, Google OAuth login). MapPin is a
 * generic location glyph — not a reproduction of Google's Maps logo — and
 * the rest are conceptual (score, pipeline, messaging), matching what the
 * product actually does. No Google Calendar: that integration doesn't
 * exist yet.
 */
const ICONS: FloatingIconSpec[] = [
  { Icon: WhatsAppIcon, top: "6%", left: "-4%", delay: "0s", bg: "bg-[#25D366]/10", iconClass: "text-[#25D366]" },
  { Icon: MapPin, top: "58%", left: "-6%", delay: "0.6s", bg: "bg-primary-soft", iconClass: "text-primary" },
  { Icon: GoogleIcon, top: "88%", left: "10%", delay: "1.2s", bg: "bg-surface", iconClass: "" },
  { Icon: Target, top: "4%", left: "92%", delay: "0.3s", bg: "bg-primary-soft", iconClass: "text-primary" },
  { Icon: GitBranch, top: "52%", left: "100%", delay: "0.9s", bg: "bg-primary-soft", iconClass: "text-primary" },
  { Icon: MessageCircle, top: "86%", left: "82%", delay: "1.5s", bg: "bg-primary-soft", iconClass: "text-primary" },
];

export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {ICONS.map(({ Icon, top, left, delay, bg, iconClass }, i) => (
        <div
          key={i}
          className={`animate-float absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border shadow-elevated ${bg}`}
          style={{ top, left, animationDelay: delay }}
        >
          <Icon className={`h-5 w-5 ${iconClass}`} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into HeroSection around the product demo**

In `apps/web/src/components/marketing/HeroSection.tsx`, add the import:
```tsx
import { FloatingIcons } from "./FloatingIcons";
```

Replace:
```tsx
      <MarketingContainer width="showcase" className="mt-14 md:mt-16">
        <HeroProductDemo />
      </MarketingContainer>
```
With:
```tsx
      <MarketingContainer width="showcase" className="relative mt-14 md:mt-16">
        <FloatingIcons />
        <HeroProductDemo />
      </MarketingContainer>
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/FloatingIcons.tsx apps/web/src/components/marketing/HeroSection.tsx
git commit -m "feat: add floating integration icons around hero product demo"
```

---

### Task 5: Illustrative activity card in HeroProductDemo

**Files:**
- Modify: `apps/web/src/components/marketing/HeroProductDemo.tsx`

**Interfaces:**
- Consumes: `hotLead` (already defined at line 40 of this file, `DEMO_LEADS[0]`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add the toast card as the last child of the right-column stack**

In `apps/web/src/components/marketing/HeroProductDemo.tsx`, inside the right column `<div className="flex flex-col gap-3">`, after the existing "Message preview hint" block (ends around line 230, right before the closing `</div>` at line 231), add:

```tsx
          {/* Illustrative activity toast — same demo data as the rest of this mockup */}
          <div
            className="animate-slide-up flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-card"
            style={{ animationDelay: "0.65s" }}
          >
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="font-medium text-foreground">Nova empresa encontrada</span>
              <span className="text-muted-foreground"> · Score {hotLead.score} — {hotLead.companyName}</span>
            </div>
          </div>
```

`TrendingUp` is already imported at the top of this file (line 5) — no new import needed.

- [ ] **Step 2: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/marketing/HeroProductDemo.tsx
git commit -m "feat: add illustrative activity card to hero product demo"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run full quality gates**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: all three pass with no errors.

- [ ] **Step 2: Manual browser check**

Start the dev server and open the landing page (`/`). Confirm:
- Headline reads "Pare de adivinhar quem prospectar. Veja o score antes de ligar."
- Social proof badges show "4.7 Google" and "4.8 Trustpilot · 185 avaliações" above the eyebrow.
- 6 floating icons appear around the hero product demo on desktop width (≥768px) and are absent below that (check with the responsive resize tool).
- The new activity toast card appears at the bottom of the right column in the hero mockup, showing "Nova empresa encontrada · Score 89 — Rústica Barbearia".
- No Google Calendar icon or claim appears anywhere in the hero.
- Check both light and dark mode — icon backgrounds and text stay legible in both.

- [ ] **Step 3: Commit (only if Step 2 required fixes)**

If the manual check found nothing to fix, skip this step — Task 5's commit is the final one. If fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: address visual issues found in hero redesign browser check"
```
