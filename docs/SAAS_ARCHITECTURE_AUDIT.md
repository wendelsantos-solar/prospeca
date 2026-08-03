# SaaS Architecture Audit — Prospeca

**Data:** 2026-07-30
**Branch:** `feat/saas-production-readiness`
**Baseline checks:** typecheck ✅ | lint ✅ | build ✅ | tests ✅ (69 pass, 0 fail)

---

## Diagrama de arquitetura

```text
Cliente (Browser)
  │
  ├─ Rota pública (/login, /cadastro, /precos, /)
  │   └─ Marketing site + auth pages
  │
  └─ Rota autenticada (/app/*)
      │
      ▼
  React SPA (TanStack Start/Router/Query, Tailwind, shadcn/ui)
      │
      │ HTTPS + JWT (Supabase Auth)
      │
      ▼
  Supabase Edge Functions (Deno + TypeScript)
      │  ├─ create-search          (autenticado, quota, geocode, dispara execute-search)
      │  ├─ execute-search         (service role, Google Places API)
      │  ├─ import-search-results  (autenticado, dedupe, cria leads)
      │  ├─ enrich-discovery       (autenticado, website scraper, SSRF-guarded)
      │  ├─ enrich-lead            (autenticado, website scraper)
      │  ├─ cancel-search          (autenticado)
      │  ├─ get-search-status      (autenticado)
      │  ├─ create-export          (autenticado, rate-limit)
      │  ├─ get-usage-summary      (autenticado)
      │  ├─ get-admin-overview     (autenticado, platform_admin check)
      │  ├─ set-org-budget         (autenticado, platform_admin check)
      │  ├─ delete-account-data    (autenticado, LGPD erasure)
      │  ├─ recover-stuck-searches (service role, cron)
      │  ├─ refresh-place-details  (service role)
      │  ├─ calculate-lead-score   (service role)
      │  ├─ geocode-location       (autenticado)
      │  └─ submit-sales-contact   (autenticado)
      │
      ▼
  Supabase PostgreSQL + PostGIS
      ├── auth schema (Supabase managed)
      ├── public schema
      │   ├── organizations
      │   ├── organization_members
      │   ├── profiles
      │   ├── searches / places / search_results
      │   ├── leads / lead_notes / lead_activities / lead_stage_history
      │   ├── message_templates
      │   ├── audit_logs
      │   ├── usage_events / usage_counters
      │   ├── credit_balances / credit_transactions
      │   ├── billing_plans / billing_customers / subscriptions / billing_events
      │   ├── suppression_list
      │   ├── exports
      │   ├── idempotency_keys
      │   └── geocode_cache
      │
      ▼
  Serviços externos
      ├── Google Places API (New) — Text Search / Nearby / Details
      ├── Google Geocoding API
      └── Stripe (planejado, não conectado)

  Workers / Cron (pg_cron)
      ├── recover-stuck-searches (a cada 5 min)
      └── purge-stale-discovery-pii (diário 03:00 UTC)
```

---

## Estrutura do repositório

```
leads-platform/              # monorepo (Bun workspaces)
├── apps/web/                # Frontend React SPA + TanStack Start SSR
│   ├── src/
│   │   ├── components/      # UI components
│   │   │   ├── app/         # Application components
│   │   │   ├── auth/        # Auth components
│   │   │   ├── marketing/   # Landing page sections
│   │   │   ├── shared/      # Shared UI (DataTable, EmptyState, etc.)
│   │   │   └── ui/          # shadcn/ui primitives
│   │   ├── design-system/   # Design System V2 (in progress)
│   │   ├── hooks/           # React hooks
│   │   ├── lib/             # Utilities, env, supabase client
│   │   ├── mocks/           # Demo data
│   │   ├── repositories/    # Data access (Supabase | Demo)
│   │   ├── routes/          # TanStack Router file-based routes
│   │   ├── services/        # Business logic services
│   │   ├── stores/          # Zustand stores
│   │   └── types/           # TypeScript type definitions
│   └── public/              # Static assets
│
├── packages/
│   ├── domain/              # Pure domain logic (score, address, dedup, entitlements)
│   └── geo/                 # Pure geographic utilities
│
├── supabase/
│   ├── config.toml          # Local Supabase config
│   ├── migrations/          # 32 migration files (ordered)
│   ├── functions/           # 17 Edge Functions
│   │   └── _shared/         # Shared utilities (auth, http, google, quota, etc.)
│   └── seed/                # Seed data
│
├── docs/                    # Extensive documentation (already exists)
├── infra/                   # Infrastructure configs
├── scripts/                 # Utility scripts (Deno)
└── .github/                 # GitHub configs
```

## Stack tecnológica

| Camada             | Tecnologia                                             |
| ------------------ | ------------------------------------------------------ |
| Frontend framework | React 19 + TanStack Start/Router/Query                 |
| Styling            | Tailwind CSS + shadcn/ui                               |
| State management   | Zustand (persisted)                                    |
| Backend runtime    | Deno (Supabase Edge Functions)                         |
| Database           | PostgreSQL 17 + PostGIS                                |
| Auth               | Supabase Auth (JWT)                                    |
| Package manager    | Bun 1.3.14                                             |
| Monorepo           | Turborepo                                              |
| Validation         | Zod                                                    |
| Maps               | Google Maps JS API (browser) + Leaflet (demo fallback) |
| External APIs      | Google Places API (New), Google Geocoding API          |
| Payments           | Stripe (planned, not yet connected)                    |

## Aplicações

| App                     | Descrição                | Status                 |
| ----------------------- | ------------------------ | ---------------------- |
| `apps/web`              | Frontend React SPA + SSR | Funcional, em evolução |
| Supabase Edge Functions | 17 funções serverless    | Funcional              |

## Pacotes compartilhados

| Pacote          | Descrição                                                                      | Status                   |
| --------------- | ------------------------------------------------------------------------------ | ------------------------ |
| `@leads/domain` | Pure domain logic (score, address, entitlements, dedup, SSRF guard, normalize) | Funcional, 14 test files |
| `@leads/geo`    | Geographic utilities (haversine, bounding box, coordinate validation)          | Funcional                |

## Ambientes

| Ambiente     | Config                                               | Status              |
| ------------ | ---------------------------------------------------- | ------------------- |
| `local`      | Supabase local (config.toml) + `VITE_DATA_MODE=demo` | Funcional           |
| `staging`    | Não documentado formalmente                          | **Pendente**        |
| `production` | Supabase Cloud                                       | Assume-se funcional |

## Deploy

- Frontend: build via `bun run build` (Vite + TanStack Start)
- Edge Functions: deploy via Supabase CLI
- Migrations: Supabase CLI (`supabase db push` ou via CI)
- CI/CD: GitHub Actions (`.github/` directory exists, não auditado em detalhe)

## Autenticação

| Funcionalidade         | Status | Notas                                                 |
| ---------------------- | ------ | ----------------------------------------------------- |
| Cadastro (email/senha) | ✅     | `signUp()` com `full_name` + `company_name`           |
| Login (email/senha)    | ✅     | `signInWithPassword()`                                |
| Logout                 | ✅     | `signOut()`                                           |
| Refresh de sessão      | ✅     | `autoRefreshToken: true`                              |
| Verificação de e-mail  | ⚠️     | `enable_confirmations = false` no config local        |
| Recuperação de senha   | ✅     | `resetPasswordForEmail()`                             |
| Redefinição de senha   | ✅     | `updatePassword()`                                    |
| Proteção de rotas      | ✅     | `AuthGate` no layout `/app`                           |
| Login social           | ❌     | Não implementado                                      |
| CSRF protection        | ✅     | Supabase gerencia                                     |
| Rate limiting          | ✅     | Via Supabase Auth config                              |
| Confirmação de e-mail  | ⚠️     | Desabilitado localmente (deve ser habilitado em prod) |
| Exclusão de conta      | ✅     | `delete-account-data` edge function (cascata LGPD)    |

## Autorização

| Funcionalidade                      | Status | Notas                                                   |
| ----------------------------------- | ------ | ------------------------------------------------------- |
| RLS em todas tabelas                | ✅     | 19+ tabelas com RLS via `is_organization_member()`      |
| Backend verifica acesso             | ✅     | `requireAuth()` em todas edge functions                 |
| Frontend NÃO é fonte de autorização | ✅     | Políticas no banco, backend valida                      |
| Roles (owner/admin/member)          | ✅     | `organization_members.role` + `has_organization_role()` |
| Platform admin                      | ✅     | `is_platform_admin()` RPC + `useIsPlatformAdmin()` hook |
| Queries filtradas por org           | ✅     | `organization_id` em todas queries                      |

## Modelo de dados

### Dados com tenant (organization_id)

| Tabela               | Tem organization_id | RLS             |
| -------------------- | ------------------- | --------------- |
| organizations        | N/A (é o tenant)    | ✅              |
| organization_members | ✅                  | ✅              |
| profiles             | ❌ (user-scoped)    | ✅ (owner only) |
| searches             | ✅                  | ✅              |
| places               | ✅                  | ✅              |
| search_results       | ✅ (via search)     | ✅              |
| leads                | ✅                  | ✅              |
| lead_notes           | ✅                  | ✅              |
| lead_activities      | ✅                  | ✅              |
| lead_stage_history   | ✅                  | ✅              |
| message_templates    | ✅                  | ✅              |
| audit_logs           | ✅                  | ✅              |
| usage_events         | ✅                  | ✅              |
| usage_counters       | ✅                  | ✅              |
| credit_balances      | ✅                  | ✅              |
| credit_transactions  | ✅                  | ✅              |
| suppression_list     | ✅                  | ✅              |
| exports              | ✅                  | ✅              |
| idempotency_keys     | ✅                  | ✅              |

### Dados globais (sem organization_id)

| Tabela            | Notas                                           |
| ----------------- | ----------------------------------------------- |
| billing_plans     | Catálogo de planos — pública para authenticated |
| billing_customers | Service role only                               |
| subscriptions     | Scoped via organization_id                      |
| billing_events    | Service role only                               |
| geocode_cache     | Service role only (derived data, sem org scope) |
| profiles          | User-scoped (1:1 com auth.users)                |

## Conclusão da auditoria de arquitetura

O Prospeca possui uma arquitetura moderna, bem estruturada e surpreendentemente madura
para um MVP. A base multi-tenant, segurança via RLS, padrão repository, e separação
limpa entre domínio puro e I/O já estão implementados.

**Principais lacunas identificadas:**

1. Sem sistema de convites para organizações (`organization_invitations`)
2. Sem infraestrutura de piloto (Pilot plan)
3. Sem onboarding estruturado
4. Sem sistema de feedback/suporte no produto
5. Observabilidade limitada (sem error tracking, health checks, métricas de negócio)
6. Sem estratégia documentada de backup/restore
7. Sem feature flags centralizadas
8. Sem e-mails transacionais
9. CI/CD não auditado em detalhe
10. Resolução de organização no frontend é frágil (pega primeira membership)
