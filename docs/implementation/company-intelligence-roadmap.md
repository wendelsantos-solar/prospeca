# Company Intelligence + People Intelligence + Decision Maker Detection

Status:
DONE (Fases 0–9 concluídas)

Current Phase:
14 (encerrada)

Última atualização: 2026-08-18
Branch: `feat/discovery-intelligence-v2`

---

## 0. Resumo da auditoria

O Prospeca **já possui** a maior parte das Fases 1–3 do brief implementada e em
produção, sob outros nomes. Esta iniciativa **não é um greenfield**: é o
fechamento das Fases 4–9 sobre uma fundação existente, mais a correção de
lacunas pontuais nas Fases 1–3.

Regra que rege todo o restante do documento: **reutilizar, nunca duplicar.**

---

## 1. Arquitetura atual (CURRENT ARCHITECTURE)

### Company

- Não existe tabela `companies`. A **Company canônica é `public.places`**
  (documentado em `packages/domain/src/company.ts` e `docs/COMPANY_DATA_OWNERSHIP.md`).
- `packages/domain/src/company.ts` define a interface `Company`, `CompanyStatus`,
  `COMPANY_SOURCE_PROVIDERS`, `CompanySource`.
- Regra de propriedade de dados já estabelecida: identidade + dado público
  ficam na Company; fato por tenant (score, notas, atividades, NBA) vive em
  `leads` / `company_opportunity_scores`.

### Lead

- `public.leads` (funil/CRM) referencia `places.id` via `place_id`.
- `leads.score` carrega hoje o **score V2** (materializado), com
  `leads.score_legacy_v3` guardado para rollback
  (migration `20260817000019_unify_leads_score_v2`).

### Discovery

- `execute-search` / `import-search-results` / `enrich-discovery` /
  `get_search_discovery` (RPC).
- CNAE já é acionável no discovery (migration `20260817000020_discovery_cnae`).

### Enrichment (multi-fonte) — JÁ EXISTE

- `places.enrichment_sources` jsonb: estado + TTL **por fonte**
  (`20260815000006_enrichment_sources`).
- Domínio: `packages/domain/src/enrichment-state.ts`
  (`buildSourceState`, `ENRICHMENT_SOURCE_TTL_DAYS`, `EnrichmentSourceMap`).
- TTL vigente: website 30d, **business_registry 90d**.

### Provenance — JÁ EXISTE

- `public.company_sources` (`20260815000003` + `20260815000010`):
  `organization_id, place_id, provider, provider_external_id, source_type,
raw_snapshot_ref, fetched_at, expires_at, confidence, attempts, error,
metadata`. RLS: leitura por membro da org, escrita só service-role.

### Business Registry (CNPJ) — JÁ EXISTE

- Contrato de domínio puro: `packages/domain/src/business-registry.ts`
  (`BusinessRegistration`, `BusinessRegistryProvider`, `normalizeCnpj`,
  `isValidCnpj` com checksum RFB, `registrationStatusFromSituacao`,
  `companyStatusFromRegistration`, `yearsInBusiness`).
- Adapter HTTP: `supabase/functions/_shared/business-registry.ts`
  (`BrasilApiBusinessRegistry` → `https://brasilapi.com.br/api/cnpj/v1`,
  timeout 8s, `NoopBusinessRegistry` para ambiente desabilitado,
  factory `businessRegistryProvider()` + `isBusinessRegistryDisabled()`).
- Endpoint interno: `supabase/functions/lookup-cnpj/index.ts` — autenticado +
  modo interno service-role, rate limit `cnpj_lookup` 30, `recordUsage`
  (`brasil_api`, custo medido = 0), persistência ADITIVA em `places`,
  carimbo em `enrichment_sources.business_registry` + upsert em
  `company_sources`, semântica de erro honesta
  (`not_found` / `provider_unavailable` / `provider_disabled`).
- Colunas em `places`: `tax_id, legal_name, primary_cnae, cnae_description,
secondary_cnaes, registration_status, registration_status_description,
registration_fetched_at` (`20260813000004`) + `company_size, legal_nature,
capital_social, simples_nacional, simples_opted_at, is_mei, founded_at,
registry_city, registry_state, registry_postal_code, registry_email,
registry_phone` (`20260815000010`).

### People / QSA — QUEBRADO (ver P0 abaixo)

- `places.qsa` jsonb (`20260816000017_place_qsa`), shape
  `Array<{ name, qualification }>`.
- **Não existe** entidade `Person`, relação `CompanyPerson`, `PersonResolver`,
  nem confiança/proveniência por pessoa.

#### 🔴 P0 — o mapeamento do QSA está errado e o QSA é SEMPRE vazio

`supabase/functions/_shared/business-registry.ts` lê `m.nome` e `m.qual`:

```ts
qsa: Array.isArray(raw.qsa)
  ? raw.qsa.map((m) => ({ name: (m.nome ?? "").trim(), qualification: m.qual?.trim() || null }))
          .filter((m) => m.name)
  : null,
```

A BrasilAPI (`/api/cnpj/v1`) devolve **`nome_socio`** e **`qualificacao_socio`**.
Verificado contra a API real em 2026-08-18 (CNPJ de teste, HTTP 200) — as
chaves `nome` / `qual` **não existem** no payload.

Consequência: todo sócio vira `name: ""`, o `.filter()` descarta todos, e
`places.qsa` é persistido como `[]`. A seção "Decisores" da UI mostra
"Não informado pelo cadastro público" para **toda** empresa, sempre.
A feature de decisores está morta em produção hoje.

Correção pertence à **Fase 3** (mapping), antes de qualquer trabalho de
People/Decision Maker — não adianta classificar uma lista vazia.

### Decision Maker — NÃO EXISTE

- Nenhum classificador de cargo, score, band, reasons ou explicabilidade.

### Jobs — JÁ EXISTE

- `public.jobs` (`20260813000002`) + claims (`20260815000001`), sweeper
  (`20260815000002`), idempotência (`20260815000009`), liveness
  (`20260815000012`), métricas (`20260815000008`).
- Domínio: `job.ts` (`JOB_TYPES` inclui `BUSINESS_DATA_ENRICHMENT`,
  `classifyRetryableError`, `backoffDelayMs`, `DEFAULT_MAX_ATTEMPTS`) e
  `job-queue.ts` (interface `JobQueue`).
- Worker: `process-jobs` — hoje só `BUSINESS_DATA_ENRICHMENT → enrich-discovery`.

### Scoring

- Canônica: `packages/domain/src/opportunity-score.ts` (V2, `v1.2.0`) —
  multi-componente, `confidence`, `CONFIDENCE_BANDS` (low/medium/high),
  `deriveOpportunityScoreState` (ANALISANDO / PARCIAL / FINALIZADO).
- Legada: `score.ts` (`v3.0.0`) mantida **apenas** para rollback e leitura
  histórica. Não escrever score novo por ela.
- Sinais: `signals.ts` (`COMPANY_SIGNALS`, `SIGNAL_THRESHOLDS`,
  `buildSignalEvidence` com severidade/confiança/fonte).
- Persistência: `company_opportunity_scores` (+ signals `20260815000004`).

### Frontend

- `CompanyDetailContent.tsx` → `BusinessRegistrySection.tsx` (gated por
  feature flag `cnaeIntelligenceEnabled`, default `true`).
- Exibe: razão social, CNPJ, CNAE, situação, porte, natureza jurídica,
  capital, abertura+idade, Simples/MEI, endereço/CEP/e-mail/telefone de
  registro, "Consultado em", QSA em lista plana, input manual de CNPJ,
  estados honestos de erro.
- `CompanyIntelligenceCard.tsx` — chips de evidência por sinal
  (`SignalEvidenceChips`), `ScoreStateChip`.
- Hooks: `useBusinessRegistration(placeId)` (leitura direta sob RLS),
  `useCnpjLookupMutation(placeId)`.

### Tenant

- `organization_id` em todas as tabelas + RLS via
  `public.is_organization_member(organization_id)`.
- Endurecimento de RPC em `20260815000011_rpc_membership_hardening`.
- Testes: `supabase/tests/rls-isolation.test.ts`,
  `rpc-authorization.test.ts`, `rpc-membership-hardening.test.ts`,
  `edge-organization-context.test.ts`.

### Privacidade / LGPD

- `purge_stale_discovery_pii()` (`20260816000018`) anula `qsa`,
  `registry_email`, `registry_phone` após 90 dias de
  `registration_fetched_at`, **apenas** em places não convertidos em lead.
  Job pg_cron 03:00 UTC. Documentado em `docs/DATA_PRIVACY_AND_RETENTION.md`.
- O adapter **descarta CPF** (`cnpj_cpf_do_socio`) na origem — nunca entra no
  sistema.

---

## 2. Componentes reutilizáveis (REUSE — não recriar)

| Necessidade do brief    | Já existe                                                 | Ação                        |
| ----------------------- | --------------------------------------------------------- | --------------------------- |
| `normalizeCnpj()`       | `domain/business-registry.ts`                             | reutilizar                  |
| Provider abstraction    | `BusinessRegistryProvider`                                | reutilizar                  |
| BrasilAPI provider      | `BrasilApiBusinessRegistry`                               | reutilizar + corrigir retry |
| Company DTO normalizado | `BusinessRegistration`                                    | estender (QSA rico)         |
| Persistência            | colunas `places`                                          | reutilizar                  |
| Provenance              | `company_sources`                                         | reutilizar                  |
| TTL / cache             | `enrichment_sources` + `ENRICHMENT_SOURCE_TTL_DAYS`       | reutilizar                  |
| Job queue               | `jobs` + `JobQueue` + `classifyRetryableError`            | reutilizar                  |
| Retry/backoff           | `backoffDelayMs` (domínio) + `fetchWithRetry` (google.ts) | **extrair e reutilizar**    |
| Confidence bands        | `CONFIDENCE_BANDS` / `confidenceBandFromConfidence`       | reutilizar                  |
| Evidência/UI            | `SignalEvidenceChips`                                     | reutilizar padrão           |
| API interna             | `lookup-cnpj`                                             | reutilizar/estender         |
| Tenant/RLS              | `is_organization_member`                                  | reutilizar                  |

---

## 3. Duplicações a EVITAR

Nada de: `CompanyIntelligence` table, `CompanyData`, `CompanyEnrichment`,
`CompanyRegistryData`, segundo job system, segundo score engine, segunda
função de normalização de CNPJ, segundo mecanismo de retry, segundo design
system.

**Risco real detectado:** `fetchWithRetry` está privado em
`_shared/google.ts`; o adapter da BrasilAPI faz `fetch` único. A tentação é
escrever um segundo retry — a ação correta é **extrair o existente** para
`_shared/fetch-retry.ts` e consumir nos dois.

---

## 4. Lacunas (GAPS) por fase do brief

| Fase             | Estado      | Lacuna                                                                                                 |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| 1 Foundation     | ✅ feito    | —                                                                                                      |
| 2 Provider       | 🟡 parcial  | **sem retry** em 429/5xx/timeout (brief §17)                                                           |
| 3 Enrichment     | 🟡 parcial  | disparo **só manual**; sem refresh explícito com TTL na UI                                             |
| 4 QSA/People     | 🔴 quebrado | **P0: mapping `nome`/`qual` → QSA sempre `[]`**; sem `Person`, sem relação, sem confiança/proveniência |
| 5 Decision Maker | ❌ ausente  | nenhum classificador/score/band/reasons                                                                |
| 6 API            | 🟡 parcial  | endpoint existe; falta expor pessoas/decisores                                                         |
| 7 UI             | 🟡 parcial  | sem decisor, sem evidência por pessoa, sem refresh, loading genérico                                   |
| 8 Observability  | 🟡 parcial  | `logEvent` + `company_sources.attempts/error` existem; sem métrica cache-hit/retry para o registry     |
| 9 Tests          | 🟡 parcial  | `business-registry.test.ts` existe; sem teste de QSA/classifier/score/tenant para pessoas              |

---

## 5. Riscos

- **R1 — PII estruturada.** Normalizar QSA em tabela cria uma superfície de PII
  _estruturada e pesquisável_. Os nomes já existem hoje em `places.qsa`, então
  não é dado novo; mas o expurgo de 90 dias precisa cobrir a nova tabela na
  MESMA migration, ou vira vazamento de retenção.
- **R2 — Retry sem cap.** Adicionar retry na BrasilAPI (gratuita, sem contrato
  de SLA) sem respeitar `Retry-After` pode virar abuso. Reutilizar o
  `fetchWithRetry` que já respeita o header.
- **R3 — Decision Maker Score confundido com o Opportunity Score.** São
  dimensões diferentes (brief §28). Não escrever em `company_opportunity_scores`.
- **R4 — Disparo automático de enrichment.** Automatizar `lookup-cnpj` no
  discovery muda volume de chamadas e custo/quota. Fora do escopo mínimo;
  documentar como Future Work.
- **R5 — Qualificação do QSA é texto livre da Receita.** O classificador
  determinístico precisa de normalização robusta (acento, caixa, código
  numérico `codigo_qualificacao_socio`) ou classifica errado em silêncio.

---

## 6. Decisões de arquitetura

### D1 — Company = `places` (pré-existente, mantida)

Nenhuma tabela `companies` nova.

### D2 — `company_sources` é tenant-scoped hoje (pré-existente, mantida)

Preparada para globalizar; não globalizar agora.

### D3 — BrasilAPI habilitada por default (pré-existente, mantida)

Gratuita, sem credencial. `BUSINESS_REGISTRY_DISABLED=true` desliga.

### D4 — Modelo de pessoas: HÍBRIDO (decidido 2026-08-18 pelo usuário)

`places.qsa` permanece como **snapshot bruto da fonte** (verdade da BrasilAPI,
já coberto pelo expurgo LGPD). Novas tabelas `people` + `company_people`
materializam a **relação normalizada derivada**. Reprocessar o classificador
não reconsulta a fonte. O expurgo `purge_stale_discovery_pii()` é ESTENDIDO na
mesma migration para cobrir as tabelas novas (mitiga R1).

### D5 — Decision Maker Score é separado do Opportunity Score

Nunca escrito em `company_opportunity_scores`. Dimensões distintas.

### D6 — CPF nunca entra no sistema

O adapter continua descartando `cnpj_cpf_do_socio` na origem. Não mascarar,
não armazenar, não desanonimizar.

---

## 7. DECISION REQUIRED — modelo de People Intelligence

**Problem:** o QSA vive hoje como jsonb plano em `places.qsa`. As Fases 4–5 do
brief pedem `Person` + `CompanyPerson` com `role, role_type, source,
confidence, started_at, ended_at, is_current`, e pessoa reutilizável entre
empresas. Isso é estrutura nova.

**Options:**

- **A — Tabelas `people` + `company_people`.** Normaliza. Permite pessoa em N
  empresas, proveniência e confiança por relação, base real para
  `PersonResolver` multi-fonte. Custo: 1 migration + RLS + cobertura no
  expurgo LGPD + backfill do jsonb existente.
- **B — Manter jsonb, enriquecer o shape.** `places.qsa` passa a
  `{name, qualification, qualificationCode, roleBand, decisionScore, source,
confidence, since}`. Zero migration estrutural, zero superfície nova de PII,
  expurgo já cobre. Custo: pessoa não é reutilizável entre empresas;
  `PersonResolver` multi-fonte fica bloqueado depois.
- **C — Híbrido.** `places.qsa` continua sendo o snapshot bruto da fonte
  (verdade da BrasilAPI, já expurgado) **e** `company_people` materializa a
  relação normalizada derivada, com `person_id` apontando para `people`.
  Fonte bruta e visão de domínio ficam separadas; reprocessar o classificador
  não precisa reconsultar a fonte.

**Recommendation: C. → ACEITO pelo usuário em 2026-08-18. Ver D4.**

**Reason:** o brief exige explicitamente que a pessoa possa pertencer a várias
empresas no futuro (§23) e que exista base para `PersonResolver` (§24) —
a opção B fecha essa porta. A opção A perde o snapshot bruto, que hoje é o
que o expurgo LGPD conhece e o que permite reprocessar sem gastar quota. C
preserva ambos e mantém o expurgo existente intacto, adicionando a nova
tabela ao mesmo `purge_stale_discovery_pii()` na mesma migration (mitiga R1).

---

## 8. Fases executadas

| Fase | Escopo                                                                              | Gate |
| ---- | ----------------------------------------------------------------------------------- | ---- |
| 0    | Auditoria + arquitetura + roadmap                                                   | PASS |
| 1    | Foundation — verificada, já existia; `normalizeCnpj` confirmado sem duplicata       | PASS |
| 2    | `fetchWithRetry` extraído para `_shared/fetch-retry.ts` e aplicado à BrasilAPI      | PASS |
| 3    | **P0 do QSA corrigido** + mapper puro no domínio + endereço oficial + matriz/filial | PASS |
| 4    | `people` + `company_people` + resolução do QSA + expurgo LGPD estendido             | PASS |
| 5    | `DecisionMakerRoleClassifier` + score/band/reasons/confidence                       | PASS |
| 6    | Leitura sob RLS (`useCompanyPeople`) — sem endpoint novo, convenção do projeto      | PASS |
| 7    | Seção Decisores com score, evidência, fonte, confiança + refresh                    | PASS |
| 8    | Observabilidade + revisão de segurança/PII                                          | PASS |
| 9    | Testes (unit/integração/tenant) + validação real controlada                         | PASS |

## 9. Gates

Comandos do projeto:

```
bun run lint
bun run typecheck
bun run format:check
bun test
bun run build
deno lint supabase/functions/ && deno check supabase/functions/*/index.ts
```

Resultado final:

| Gate             | Resultado                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| typecheck        | PASS (4/4 pacotes)                                                                                     |
| lint             | PASS (2 warnings `react-refresh`, idênticos ao baseline)                                               |
| format:check     | PASS                                                                                                   |
| bun test         | 836 pass / 1 fail — a falha (`COST-003`) é PRÉ-EXISTENTE, reproduzida com este trabalho em `git stash` |
| build            | PASS                                                                                                   |
| deno check       | PASS                                                                                                   |
| deno lint        | 30 problemas — PRÉ-EXISTENTES, contagem idêntica ao baseline, nenhum nos arquivos tocados              |
| tenant isolation | PASS (ISO-036…ISO-043, novos)                                                                          |
| diff review      | PASS — nenhuma alteração fora do escopo                                                                |

## 10. Implementado

**Domínio (`packages/domain`)**

- `business-registry.ts`: `QsaMember`, `EstablishmentType`, `BrasilApiCnpjPayload`,
  `mapBrasilApiCnpj`, `mapBrasilApiQsaMember`, `composeStreetAddress`,
  `establishmentTypeFromIdentifier`, `qsaMemberTypeFromIdentifier`.
- `person.ts` (novo): `normalizePersonName`, `Person`, `CompanyPersonRelation`,
  `resolvePeopleFromQsa`, `PersonResolver` (contrato para fontes futuras).
- `decision-maker.ts` (novo): `DECISION_ROLE_RULES` (tabela central e
  ajustável), `classifyDecisionRole`, `calculateDecisionMakerScore`,
  `compareDecisionMakers`.

**Edge (`supabase/functions`)**

- `_shared/fetch-retry.ts` (novo): retry único e compartilhado.
- `_shared/google.ts`: passa a consumir o retry compartilhado (era privado ali).
- `_shared/business-registry.ts`: só rede; mapeamento delegado ao domínio.
- `lookup-cnpj/index.ts`: persiste endereço/matriz-filial, resolve pessoas,
  calcula decisores, responde `peopleResolved`.

**Banco**

- `20260818000022_registry_address_establishment.sql`
- `20260818000023_people_intelligence.sql` (tabelas + RLS + expurgo estendido)

**Frontend**

- `CompanyPeopleSection.tsx` (novo), `BusinessRegistrySection.tsx` (refresh,
  frescor, endereço oficial, matriz/filial), `useLeadsQuery.ts`
  (`useCompanyPeople`, invalidação cruzada).

## 11. Defeito encontrado nos gates (Fase 12)

`deno check` e `bun run typecheck` passaram verdes com uma função **morta em
BOOT_ERROR**. Causa: o monorepo tem **três** import maps —

| Arquivo                        | Quem usa                                  |
| ------------------------------ | ----------------------------------------- |
| `deno.json`                    | `deno check` / `deno lint`                |
| `supabase/import_map.json`     | edge runtime (`[functions.*].import_map`) |
| `supabase/functions/deno.json` | resolução dentro de `supabase/functions/` |

Um alias novo foi adicionado só ao primeiro. Nenhum gate boota uma função, então
nada acusou; a função só quebraria na primeira invocação real.

Fechado por `supabase/tests/import-maps-in-sync.test.ts`, que compara os
aliases `@leads/*` dos três maps e verifica que cada alvo existe no disco.
Verificado que o teste FALHA ao remover uma chave e passa ao restaurá-la.

## 12. Validação real (brief §39)

Executada contra a BrasilAPI com CNPJ de teste, **não hardcoded**:

| Etapa             | Resultado                                                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| HTTP              | 200                                                                           |
| Mapping           | razão social, CNAE + 3 secundários, porte, capital, Simples, matriz, endereço |
| QSA               | 1 integrante (antes da correção: sempre `[]`)                                 |
| PII               | nenhum CPF/faixa etária no DTO                                                |
| People resolution | 1 pessoa                                                                      |
| Decision Maker    | score 95/100, band `high`, motivos explícitos                                 |
| Persistência      | `places` + `people` + `company_people` gravados                               |
| Idempotência      | 2ª execução → 1 pessoa / 1 relação, sem duplicar                              |
| Leitura           | score, motivos e as DUAS confianças (dado 1.0 / identidade 0.6)               |

## 12. Payload real da BrasilAPI (verificado 2026-08-18, HTTP 200)

Campos do QSA efetivamente devolvidos por item:

```
nome_socio                              qualificacao_socio
codigo_qualificacao_socio               identificador_de_socio
data_entrada_sociedade                  faixa_etaria / codigo_faixa_etaria
nome_representante_legal                qualificacao_representante_legal
codigo_qualificacao_representante_legal cpf_representante_legal      ← PII, descartar
cnpj_cpf_do_socio                       ← PII, descartar
pais / codigo_pais
```

Campos de topo ainda **não mapeados** e úteis ao brief §14:
`identificador_matriz_filial` + `descricao_identificador_matriz_filial`
(matriz/filial), `logradouro`/`numero`/`bairro`/`complemento` (endereço
oficial completo — hoje só município/UF/CEP), `codigo_natureza_juridica`,
`codigo_porte`, `qualificacao_do_responsavel`.

Política de PII (D6): `cnpj_cpf_do_socio` e `cpf_representante_legal` são
descartados no adapter, na origem. `faixa_etaria` é dado pessoal sensível sem
utilidade comercial — **não mapear**.

## 13. Limitações conhecidas

- BrasilAPI expõe apenas o DDD (`ddd_telefone_1`), não o telefone completo.
- Decision Maker v1 é determinístico por qualificação. Sem LLM, sem scraping.
- `regime_tributario` veio `[]` no CNPJ de teste — não confiável, não mapear.
- A descoberta de CNPJ é OPORTUNISTA: depende de o site responder dentro do
  orçamento de 4s do scrape de contato e de publicar o número. Numa das
  execuções de validação o mesmo site não respondeu a tempo e nenhum CNPJ foi
  achado; a execução seguinte achou. Como o TTL do website é de 30 dias, um
  CNPJ perdido só é reprocessado no próximo ciclo (ou via re-enrichment
  explícito, que ignora o filtro de frescor).
- Sites com proteção anti-bot (403) não entregam HTML — nem contato, nem CNPJ.
  Limitação pré-existente do enricher, não introduzida aqui.

## 14. Nota de ambiente local (não é defeito de código)

O edge runtime local degrada após várias execuções pesadas da suíte: a
`cost-observability` passou de 4s/8-verdes para 213s/5-falhas na terceira
rodada seguida, com o PostgREST devolvendo _"An invalid response was received
from the upstream server"_ até num INSERT direto do próprio teste. O banco tinha
98 linhas e os containers estavam ociosos — o gargalo é acúmulo de isolates no
edge runtime (`policy = "per_worker"`) contra o limite de memória do Docker.

`supabase stop && supabase start` restaura (4s, 8/8). Vale rodar isso antes de
um `verify:pilot` que precise ser confiável, e desconfiar de falha em
`cost-observability`/`job-liveness` que apareça só depois de várias rodadas.
