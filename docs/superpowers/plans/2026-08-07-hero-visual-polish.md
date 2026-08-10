# Hero Visual Polish (Revision 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the visual craft of the hero (background depth, bolder icons, richer activity card) to close the gap with the Kaptto reference, without touching any of the already-approved data/copy (headline, ratings, real-integration constraints).

**Architecture:** Pure CSS/JSX changes to 3 existing files from the first implementation pass. No new components, no new data.

**Tech Stack:** React + TypeScript, Tailwind (existing tokens). No new dependencies.

## Global Constraints

- No new claim of any kind — this is decoration and visual weight only. Source: `docs/superpowers/specs/2026-08-07-hero-social-proof-redesign-design.md`, "Revisão 2" section.
- No fake relative timestamps ("há 1 min") on the activity cards — still illustrative examples, not real-time claims.
- Runtime: `bun run typecheck`, `bun run lint`, `bun run build` — same as the first pass. No unit tests for these presentational components (established convention).

---

### Task 1: Decorative background glow + rings in HeroSection

**Files:**
- Modify: `apps/web/src/components/marketing/HeroSection.tsx`

**Interfaces:** none — pure JSX addition, no new exports.

- [ ] **Step 1: Add the decorative layer as the first child of the section**

In `apps/web/src/components/marketing/HeroSection.tsx`, immediately after the opening `<section id="produto" className="relative overflow-hidden pt-24 md:pt-32 lg:pt-36">` tag, add:

```tsx
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
        <div className="absolute left-1/2 top-1/3 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/5" />
      </div>
```

This sits behind the existing content (`-z-10`), stays clipped by the section's own `overflow-hidden`, and adds no text or claim — pure decoration.

- [ ] **Step 2: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/marketing/HeroSection.tsx
git commit -m "feat: add decorative background glow and rings to hero"
```

---

### Task 2: Bolder floating icons (solid brand colors, larger)

**Files:**
- Modify: `apps/web/src/components/marketing/FloatingIcons.tsx`

**Interfaces:** none — internal styling change only, `FloatingIcons()` signature unchanged.

- [ ] **Step 1: Switch icon backgrounds to solid, bump size**

In `apps/web/src/components/marketing/FloatingIcons.tsx`, replace the `ICONS` array with:

```tsx
const ICONS: FloatingIconSpec[] = [
  {
    Icon: WhatsAppIcon,
    top: "6%",
    left: "2%",
    delay: "0s",
    bg: "bg-[#25D366]",
    iconClass: "text-white",
  },
  {
    Icon: MapPin,
    top: "58%",
    left: "3%",
    delay: "0.6s",
    bg: "bg-primary",
    iconClass: "text-primary-foreground",
  },
  { Icon: GoogleIcon, top: "88%", left: "12%", delay: "1.2s", bg: "bg-surface", iconClass: "" },
  {
    Icon: Target,
    top: "4%",
    left: "90%",
    delay: "0.3s",
    bg: "bg-primary",
    iconClass: "text-primary-foreground",
  },
  {
    Icon: GitBranch,
    top: "52%",
    left: "97%",
    delay: "0.9s",
    bg: "bg-primary",
    iconClass: "text-primary-foreground",
  },
  {
    Icon: MessageCircle,
    top: "86%",
    left: "84%",
    delay: "1.5s",
    bg: "bg-primary",
    iconClass: "text-primary-foreground",
  },
];
```

Then update the render function's size classes — change `h-11 w-11` to `h-14 w-14` on the wrapping div, and `h-5 w-5` to `h-6 w-6` on the `<Icon>`:

```tsx
export function FloatingIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      {ICONS.map(({ Icon, top, left, delay, bg, iconClass }, i) => (
        <div
          key={i}
          className={`animate-float absolute grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border shadow-elevated ${bg}`}
          style={{ top, left, animationDelay: delay }}
        >
          <Icon className={`h-6 w-6 ${iconClass}`} />
        </div>
      ))}
    </div>
  );
}
```

The Google icon slot keeps its white background (`bg-surface`) — its "G" glyph is already multicolor, a solid brand-color fill would clash with the logo itself.

- [ ] **Step 2: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/marketing/FloatingIcons.tsx
git commit -m "feat: give floating hero icons solid brand-color backgrounds and larger size"
```

---

### Task 3: Second stacked activity card in HeroProductDemo

**Files:**
- Modify: `apps/web/src/components/marketing/HeroProductDemo.tsx`

**Interfaces:**
- Consumes: `DEMO_LEADS` (already imported at line 17); `hotLead` (already defined at line 40).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Add a second demo lead constant**

In `apps/web/src/components/marketing/HeroProductDemo.tsx`, inside `HeroProductDemo()`, right after the existing line:
```tsx
  const hotLead = DEMO_LEADS[0]; // Rústica Barbearia — Score 89
```
add:
```tsx
  const secondLead = DEMO_LEADS[2]; // Studio Aurora — used for the second activity card
```

- [ ] **Step 2: Replace the single activity toast with two stacked cards**

Replace the block added in the first pass:
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
              <span className="text-muted-foreground">
                {" "}
                · Score {hotLead.score} — {hotLead.companyName}
              </span>
            </div>
          </div>
```
With:
```tsx
          {/* Illustrative activity — two stacked example cards, no fake timestamps */}
          <div className="relative">
            <div
              className="animate-slide-up absolute inset-x-2 -top-2 -z-10 -rotate-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] opacity-80 shadow-card"
              style={{ animationDelay: "0.6s" }}
            >
              <div className="flex items-center gap-2">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <MessageCircle className="h-3.5 w-3.5" />
                </div>
                <div>
                  <span className="font-medium text-foreground">Mensagem pronta</span>
                  <span className="text-muted-foreground"> · {secondLead.companyName}</span>
                </div>
              </div>
            </div>
            <div
              className="animate-slide-up relative flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] shadow-card"
              style={{ animationDelay: "0.65s" }}
            >
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-hot-soft text-hot">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="font-medium text-foreground">Nova empresa encontrada</span>
                <span className="text-muted-foreground">
                  {" "}
                  · Score {hotLead.score} — {hotLead.companyName}
                </span>
              </div>
            </div>
          </div>
```

`MessageCircle` and `TrendingUp` are already imported at the top of this file — no new imports needed.

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/HeroProductDemo.tsx
git commit -m "feat: stack a second illustrative activity card for visual depth"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run full quality gates**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: all pass.

- [ ] **Step 2: Manual browser check**

Start the dev server, open the landing page, confirm:
- Soft glow + concentric rings visible behind the hero content, contained within the section (no horizontal scroll introduced).
- All 6 floating icons now larger with solid brand-color backgrounds (WhatsApp green, primary green for the rest, white for Google) — still fully inside the section bounds, not clipped (same 0-100% positioning as before, only size/color changed).
- Two stacked activity cards visible at the bottom of the hero mockup, back card slightly rotated and offset, front card unchanged text.
- No fake timestamps on either card.
- Light and dark mode both legible; mobile (<768px) hides the floating icons as before and the activity cards stack normally without overflow.

- [ ] **Step 3: Commit (only if Step 2 required fixes)**

If nothing needed fixing, skip — Task 3's commit is final. Otherwise:
```bash
git add -A
git commit -m "fix: address visual issues found in hero polish browser check"
```
