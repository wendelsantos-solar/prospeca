# Marketing Site V2 — Architecture

**Branch:** `feat/marketing-site-v2`
**Derived from:** `feat/saas-production-readiness` (6fd985f)

## Route architecture

### Public routes (no auth required)

| Path               | Component            | Status        |
| ------------------ | -------------------- | ------------- |
| `/`                | `LandingPage` (lazy) | ✅ V2 rebuilt |
| `/precos`          | `PricingPage`        | ✅ V2 rebuilt |
| `/cadastro`        | `SignUpPage`         | ✅ Existing   |
| `/login`           | `LoginPage`          | ✅ Existing   |
| `/privacidade`     | Placeholder page     | ✅ Existing   |
| `/termos`          | Placeholder page     | ✅ Existing   |
| `/recuperar-senha` | Password recovery    | ✅ Existing   |
| `/redefinir-senha` | Password reset       | ✅ Existing   |

### Authenticated routes (require session in real mode)

| Path                 | Component                              | Status      |
| -------------------- | -------------------------------------- | ----------- |
| `/app`               | `AppLayout` → redirects to `/app/mapa` | ✅ Existing |
| `/app/mapa`          | Map + search + list                    | ✅ Existing |
| `/app/painel`        | Analytics dashboard                    | ✅ Existing |
| `/app/kanban`        | Pipeline kanban                        | ✅ Existing |
| `/app/hoje`          | Today view                             | ✅ Existing |
| `/app/agenda`        | Calendar/activities                    | ✅ Existing |
| `/app/historico`     | History                                | ✅ Existing |
| `/app/configuracoes` | Settings                               | ✅ Existing |
| `/app/admin`         | Admin panel                            | ✅ Existing |

### Routes missing (planned)

| Path             | Status                                       |
| ---------------- | -------------------------------------------- |
| `/para-agencias` | Not created (content in `#agencias` anchor)  |
| `/contato`       | Not created (uses `SalesContactForm` dialog) |
| `/entrar`        | Not created (use `/login`)                   |

## Root behavior

- `/` now **always** shows the landing page, regardless of auth state
- Authenticated users see "Ir para o aplicativo" in the header instead of "Entrar"
- Previously: authenticated users were force-redirected to `/app/mapa`

## Component architecture

### Marketing layout (new)

```
MarketingLayout.tsx
├── MarketingPage          — Page shell (skip link, header, main, footer)
├── MarketingSection       — Section with spacing tokens (sm/md/lg/xl)
├── MarketingContainer     — Width tokens (narrow/default/wide/showcase)
├── SectionHeading         — Heading with eyebrow + title + description
└── Eyebrow                — Small uppercase label
```

### Components updated in V2

| Component            | Changes                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `MarketingHeader`    | Auth state, scroll detection, max-w-7xl, animated mobile menu        |
| `HeroSection`        | Larger typography (36-56px), realistic product demo, wider container |
| `HeroProductDemo`    | **New** — coded composition of real product surfaces                 |
| `TrustStrip`         | Better icons (h-5 w-5), bordered icon containers, hover states       |
| `ProblemSection`     | Refined Before/After cards with status badges                        |
| `HowItWorksSection`  | Icon containers, step numbers, hover states                          |
| `MapSection`         | Realistic map with grid, roads, markers, tooltip, search bar         |
| `PipelineSection`    | Real lead cards with company data, scores, next actions              |
| `MessagingSection`   | WhatsApp preview bubble                                              |
| `ScoreSection`       | Score display with criteria using mapped icons                       |
| `OpportunitySection` | Dynamic lead signals from demo data                                  |
| `UseCasesSection`    | Icon containers, hover states                                        |
| `AgencySection`      | Icon+label cards for team features                                   |
| `BenefitsSection`    | Icon+text grid                                                       |
| `PricingTeaser`      | Feature lists per plan, better card layout, PlanCard reuse           |
| `PricingPage`        | MarketingPage wrapper, updated typography                            |
| `FAQSection`         | Custom FaqItem with Plus/Minus icons, animated expand                |
| `FinalCTA`           | Updated typography, MarketingContainer usage                         |
| `MarketingFooter`    | 5-column layout, Legal section, better link structure                |

### Demo data (new)

```
src/marketing/demo-data/index.ts
├── DEMO_LEADS         — 8 fictitious leads with consistent data
├── PIPELINE_STAGES    — Stage definitions with counts
├── SCORE_CRITERIA     — Score factors with icons and points
├── DEMO_SEARCH        — Sample search parameters
└── MESSAGE_TEMPLATE_DEMO — Sample message template
```

### Layout tokens

| Token      | Value              | Usage                           |
| ---------- | ------------------ | ------------------------------- |
| `narrow`   | 720px              | FAQ, final CTA, text-heavy      |
| `default`  | 1120px (max-w-6xl) | Standard sections               |
| `wide`     | 1280px (max-w-7xl) | Map demo, pipeline, comparisons |
| `showcase` | 1360px             | Hero product demo               |

### Section spacing tokens

| Token | Desktop | Mobile |
| ----- | ------- | ------ |
| `sm`  | 80px    | 64px   |
| `md`  | 96px    | 80px   |
| `lg`  | 112px   | 96px   |
| `xl`  | 128px   | 112px  |

## Key architectural decisions

1. **No parallel design system** — Marketing components use the same tokens (`styles.css`) as the app
2. **No fake data** — Demo data is clearly marked as fictitious, no real customer info
3. **No hardcoded prices** — `PricingTeaser` and `PricingPage` fetch from `billing_plans` table
4. **Auth-agnostic landing** — Both anonymous and authenticated users can browse
5. **SSR SEO** — Every public route has proper `head()` with title, description, OG tags
