# Discovery Intelligence V2 — Auditoria de Arquitetura

> Fase 0. Documento baseado em leitura direta do código, não em suposição.
> Branch: `feat/discovery-intelligence-v2` (criada a partir de `main`, **sem commit** — working tree preservado).

## 1. Baseline

| Item | Estado |
|---|---|
| Branch | `feat/discovery-intelligence-v2` (nova; nada commitado) |
| Working tree | Preservado — onda de "estado de enriquecimento" + KPIs + heatmap + missão + buscas salvas (não commitada) |
| `bun run lint` | ✅ 0 errors (1 warning pré-existente em `SettingsTabs.tsx`) |
| `bun run typecheck` | ✅ 4/4 pacotes |
| `bun run test` | ✅ 131 pass / 0 fail |
| `bun run build` | ✅ (1 warning `INEFFECTIVE_DYNAMIC_IMPORT`, pré-existente) |

---

## 2. Arquitetura atual (Antes)

```
Browser (React 19 SPA — TanStack Start/Router/Query, Tailwind, shadcn)
  │  HTTPS + JWT (Supabase Auth)  +  leitura direta PostgREST sob RLS
  ▼
Supabase Edge Functions (Deno)  ← backend único (25 functions, sem servidor próprio)
  │  create-search → execute-search → import-search-results → enrich-*
  │  recover-stuck-searches (pg_cron, 5min) · purge PII (diário)
  ▼
PostgreSQL 17 + PostGIS (Supabase)  — RLS multi-tenant, migrations versionadas
  │
  └─ Externo: Google Places/Geocoding · Anthropic · Stripe · Resend ·
      Google Calendar/Meet · Sentry
```

Monorepo **Bun + Turborepo**: `apps/web` + `packages/contracts` (tipos/zod) + `packages/domain` (regras puras) + `packages/geo`.

**Decisão arquitetural central (ADR-001):** manter Supabase; **não existe Redis/BullMQ**. "Fila" = `functions.invoke` encadeado + `searches.status` em tabela + polling/Realtime. O ADR prevê promover worker Node/Redis **somente se** o timeout de edge function estourar.

---

## 3. Modelo de dados atual (Company ↔ Lead)

### Fato central (a divergência mais importante)

O Prospeca **já separa Discovery × CRM**, mas com uma diferença-chave em relação ao target V2:

| Conceito V2 | Entidade atual | Observação crítica |
|---|---|---|
| **Company (canônico)** | `places` | **É tenant-scoped**: tem `organization_id` + `unique (organization_id, provider, provider_place_id)`. Ou seja, cada org tem sua própria cópia do mesmo lugar — **não é canônico global**. |
| **Lead** | `leads` | Tem `place_id` FK (já linka à Company) + `unique (organization_id, place_id)`. **Mas denormaliza** contato/score/temperatura (cópia dos dados da empresa). |
| **Score por org** | `leads.score` + `leads.score_breakdown` + `leads.score_rule_version` | Score fica no **lead**, não na company, e a fórmula é **global** (v3.0.0), não por-org. |
| **Fontes/proveniência** | `lead_sources` (lead-scoped) + `lead_enrichments` (field-level) + `lead_scores` (histórico append-only) | Proveniência é **por lead**, não por company. |
| **Job/queue** | `searches.status` (estado) + `functions.invoke` + `idempotency_keys` + `usage_events` | Não há tabela de jobs nem abstração de fila. |

### Tabelas autoritativas (verificadas)

| Domínio | Tabelas |
|---|---|
| Tenant | `organizations`, `organization_members`, `profiles`, `platform_admins`, `organization_invitations` |
| Busca | `searches`, `places`, `search_results`, `provider_search_cache`, `geocode_cache` |
| CRM | `leads`, `lead_notes`, `lead_activities`, `lead_stage_history`, `message_templates` |
| Enriquecimento/proveniência | `lead_sources`, `lead_enrichments`, `lead_scores` (+ `enrichment_state`/`enrichment_fields` em `places`, não commitados) |
| Billing | `billing_plans`, `billing_customers`, `subscriptions`, `usage_counters`, `billing_events`, `credit_balances`, `credit_transactions` |
| Ops/segurança | `usage_events`, `audit_logs`, `idempotency_keys`, `suppression_list`, `exports`, `rate_limit_events`, `error_events` |

### Fluxo de busca atual

`create-search` (enfileira) → `execute-search` (Google Text Search, paginado, cache 3 níveis) → `import-search-results` (persiste `places` + `search_results`) → `enrich-discovery` (scrape do site → email/instagram/whatsapp, idempotente/aditivo, SSRF-guard) → `calculate-lead-score` (determinístico). Progresso via Realtime/polling; `recover-stuck-searches` destrava buscas presas.

### Scoring atual

`packages/domain/src/score.ts` — **v3.0.0 determinístico**. Sinais: `no_website (+30)`, `weak_reputation (+15)`, `low_traction (+10)`, `valid_phone (+20)`, `whatsapp (+12)`, `email (+8)`, `instagram (+5)`, proximidade, categoria. Guarda: negócio não-operacional → score 0. Breakdown explicável. Temperatura: hot ≥75 / warm ≥45 / cold <45.

---

## 4. Gap analysis (spec V2 → estado atual)

Legenda: ✅ já existe · 🟡 parcial · ❌ ausente

| # | Área | Estado | Nota |
|---|---|---|---|
| 2, 24 | Company × Lead separados | 🟡 | Existe (`places`↔`leads`), mas `places` é tenant-scoped e `leads` denormaliza |
| 7, 8 | SearchIntentParser (NL → filtros) | ❌ | Form é discreto (nicho/local/raio/presença) |
| 9, 10 | BusinessTaxonomy (termo→categoria→Places→CNAE) | ❌ | `NICHES` hardcoded no frontend |
| 12–15, 17 | Pipeline assíncrono + fila visível | 🟡 | Estado em `searches` + Realtime; sem fila/jobs formal |
| 13, 73–75 | JobQueue + observabilidade + DLQ + Admin Jobs | ❌ | Sem abstração de fila nem DLQ |
| 19–23 | Idempotência/retry/timeout/circuit-breaker/rate-limit | 🟡 | `idempotency_keys`, rate-limit fail-closed existem; retry/backoff/CB parcial |
| 26 | company_sources (proveniência por company) | 🟡 | `lead_sources` é por lead, não por place |
| 27 | Deduplicação multi-sinal | 🟡 | `unique(org, place_id)` + hash de contato; sem confidence/merge |
| 29–31 | DigitalPresenceProfile / website / social intelligence | 🟡 | Presença digital básica (site/instagram/whatsapp); sem perfil/estado strong/medium/weak |
| 32 | WhatsApp phone_found × probable × validated | 🟡 | `whatsapp_status` (unknown/possible/verified/invalid) já existe |
| 33 | Reputation Intelligence | ❌ | Só rating/review_count; sem sentiment/keywords |
| 34–36, 60 | Opportunity Score + Signals + temperatura | 🟡 | Score determinístico existe; sinais implícitos (não nomeados/armazenados) |
| 59–62 | Score por organização + versionamento | 🟡 | Versão existe (`v3.0.0`); **score global, não por-org** |
| 37, 40, 41 | Territory Intelligence | ❌ | Ausente |
| 38, 39 | Heatmap por métrica | 🟡 | Heatmap de oportunidade recém-adicionado (uma métrica só) |
| 42, 46 | KPIs + cards densos | 🟡 | KPIs recém-adicionados |
| 48–58 | Company Intelligence Panel + NBA + abordagem | 🟡 | `LeadDetailsDrawer` + `generate-contact-message`; NBA parcial |
| 28, 107 | Dados cadastrais / CNAE / Business Registry | ❌ | Sem provider cadastral (necessário adapter + Noop/Mock) |
| 65 | Saved Search | 🟡 | Migration + frontend recém-adicionados (não commitados) |
| 66 | Monitorar região | ❌ | Preparar estrutura de saved search |
| 96 | Feature flags | 🟡 | `env.ts` já tem flags (`realSearch`, `websiteEnrichment`…); faltam as V2 |

---

## 5. Decisões arquiteturais que precisam de você

1. **Company global vs tenant.** Hoje `places` é por-org. O spec V2 (#24, #94) sugere Company canônico *potencialmente global* (dados públicos compartilhados entre tenants) com score/lead por-org. Mudar `places` para global mexe em RLS, dedup e licenciamento de fontes. **Recomendo**: manter `places` como a entidade Company (evoluir, não criar `companies` paralela), e tratar a decisão global-vs-tenant como evolução posterior — mas preciso do seu call.

2. **Redis/BullMQ vs fila atual.** ADR-001 (existente) diz *sem Redis/BullMQ*; o spec prefere BullMQ "se compatível". **Recomendo**: criar a abstração `JobQueue` (interface no domínio) agora, manter o transporte atual (functions.invoke + tabela de jobs) e deixar BullMQ como implementação futura quando o timeout de edge function estourar. Não acoplar domínio ao BullMQ (o spec exige isso também).

3. **Score: separar `global_quality_score` × `opportunity_score` por org.** É aditivo (nova tabela `company_opportunity_scores`), não quebra o `leads.score` atual. **Recomendo**: fazer.

4. **Naming.** Manter `places` internamente (evitar rename de tabela arriscado) e expor "Company" na camada de domínio/API. Alternativa: `CREATE VIEW companies` para compat. **Recomendo**: manter `places`, mapear para `Company` no domínio.

---

## 6. Plano de implementação (fases)

Fase 0 — Auditoria (✅ este documento) →
Fase 1 — Domain Model (Company/Sources/Signals/Score) →
Fase 2 — Search Domain (Intent/Taxonomy) →
Fase 3 — Queue (abstração + jobs) →
Fase 4 — Discovery (normalização + dedup) →
Fase 5 — Enrichment (business/contact/digital/whatsapp/reputation) →
Fase 6 — Scoring (signals + por-org + confidence) →
Fase 7 — Territory (densidade/agregação/insight) →
Fase 8 — Intelligence (Company Panel + NBA + abordagem) →
Fase 9 — UI (Descobrir V2) →
Fase 10 — CRM (Company→Lead) →
Fase 11 — Observabilidade (jobs/metrics/DLQ/admin) →
Fase 12 — Testes (unit/integration/E2E/load).

Estratégia: feature flags (`discoveryV2`, `heatmapEnabled`, `territoryIntelligenceEnabled`, `asyncEnrichmentEnabled`, `cnaeIntelligenceEnabled`, `nextBestActionEnabled`), V1 preservado atrás de flag até o rollout.

## 7. O que já existe e NÃO deve ser recriado

- `packages/domain/src/score.ts` (v3.0.0) → evoluir, não duplicar.
- `places`/`search_results`/`leads` + RLS → base da evolução.
- `lead_sources`/`lead_enrichments`/`lead_scores` → base de provenance/histórico.
- `idempotency_keys`, `usage_events` (com `estimated_cost`), `provider_search_cache`, `geocode_cache`.
- `_shared/*` (auth, http, google, quota, rate-limit, idempotency, entitlements, error-tracking, enrich).
- Frontend: `app.mapa.tsx`, `MapView` (Google/Leaflet), `LeadDetailsDrawer`, `ResultsList`, heatmap/KPIs/mission recém-adicionados.
- `docs/` já tem `SAAS_ARCHITECTURE_AUDIT.md`, `MULTI_TENANCY_DECISION.md`, `OBSERVABILITY.md`, spec `discovery-vs-crm-separation` e roadmap V2 — este doc complementa, não substitui.
