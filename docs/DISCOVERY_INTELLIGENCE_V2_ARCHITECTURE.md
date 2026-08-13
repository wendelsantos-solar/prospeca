# Discovery Intelligence V2 — Arquitetura

> Complementa `DISCOVERY_INTELLIGENCE_V2_AUDIT.md`. Descreve o que foi **implementado**.
> Branch: `feat/discovery-intelligence-v2`.

## Fluxo alvo

```
MISSÃO → DESCOBERTA → EMPRESA → ENRIQUECIMENTO → SINAIS → SCORE → TERRITÓRIO → INTELIGÊNCIA → AÇÃO → CRM
```

## Camadas implementadas

### 1. Domínio puro (`packages/domain/src/`) — sem I/O, testado

| Módulo | Responsabilidade | Spec |
|---|---|---|
| `company.ts` | `Company` canônico + `CompanySource` + status | #24, #26, #28 |
| `signals.ts` | 13 sinais nomeados + `deriveSignals` | #60 |
| `opportunity-score.ts` | Score multi-componente (7) + confidence + por-org | #34, #35, #59, #62, #79 |
| `search-intent.ts` | `parseSearchIntent` (NL determinístico → filtros) | #7, #8 |
| `taxonomy.ts` / `taxonomy-data.ts` | `resolveTaxonomy` + seed (aliases/Places/CNAE) | #9, #10 |
| `job.ts` / `job-queue.ts` | Tipos de job, estados, retry/backoff/DLQ + interface `JobQueue` | #13–15, #20, #74 |
| `territory.ts` | `aggregateTerritories` + insights + `heatMetricWeight` | #37–41 |
| `next-best-action.ts` | `recommendNextBestAction` | #56 |

Mantidos/evoluídos: `score.ts` (v3.0.0, ativo), `dedup.ts`, `cache.ts`, `status.ts`, `enrichment-state.ts`.

### 2. Banco (`supabase/migrations/`)

| Migration | Tabela/objeto | Spec |
|---|---|---|
| `20260813000001` | `company_opportunity_scores` (score por-org, `unique(org,place,version)`) | #61 |
| `20260813000002` | `jobs` (fila observável, tenant-scoped) | #14, #15 |
| `20260813000003` | `business_taxonomies` + seed | #10 |

**Decisão**: `places` **é** a Company (não foi criada tabela `companies` paralela — ver `COMPANY_DATA_OWNERSHIP.md`). `place_id` no banco = `companyId` no domínio.

### 3. Edge Functions (Deno)

| Function | Faz | Status |
|---|---|---|
| `score-company` | `deriveSignals` + `calculateOpportunityScore` → `company_opportunity_scores` (valida `searchId` da org) | deployada |
| `interpret-search-intent` | `parseSearchIntent` + `resolveTaxonomy` → resposta estruturada | deployada |

Transporte da fila: `functions.invoke` + tabela `jobs` (ADR-001 — **sem Redis/BullMQ**). `JobQueue` é a abstração; BullMQ é implementação futura.

### 4. Frontend (`apps/web/`)

| Componente | Spec |
|---|---|
| `MissionInput` (missão NL no `SearchForm`) | #7, #8 |
| `CompanyIntelligenceCard` (score 7 componentes + sinais + NBA, no drawer) | #48–58 |
| `TerritoriesView` (aba Regiões) | #40, #41 |
| Heatmap por métrica (oportunidade/densidade/presença fraca) + seletor no `TopNav` | #38, #39 |
| Feature flags V2 em `feature-flags.ts` | #96 |

Rotas preservadas: `/app/mapa` continua funcionando (V1 preservada); V2 aditivo atrás de flag `discoveryV2`.

## Decisões de design (resumo)

1. **Company = `places`** (evolução, não tabela nova).
2. **Score por-org** separado do score global (tabela própria, aditivo).
3. **JobQueue** desacoplado do transporte (interface, não BullMQ).
4. **Intent parser** determinístico como fallback; LLM (schema-validado) é o caminho primário futuro.
5. **CNAE só onde confiável** — fonte cadastral pendente (`cnaeIntelligenceEnabled=false`).

## Próximos passos (não implementados)

- Admin "Processamento" (UI de jobs + DLQ reprocessar/descartar) — tabela `jobs` + `isDeadLetter` prontos.
- Provider Business Registry (CNPJ) — adapter `Noop`/`Mock` + env.
- E2E do fluxo completo + load test.
